import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { FIELD_SYNC_ERROR_CODES, FIELD_SYNC_MAX_BATCH_SIZE } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import type { FieldSyncBatchDto } from "./dto/field-workflows.dto";
import { FieldBackupRequestsService } from "./field-backup-requests.service";
import { FieldBoloService } from "./field-bolo.service";
import { FieldCheckpointsService } from "./field-checkpoints.service";
import { FieldCheckpointHardeningService } from "./field-checkpoint-hardening.service";
import { FieldOfficerSafetyService } from "./field-officer-safety.service";
import { FieldOperationalResponsesService } from "./field-operational-responses.service";
import { FieldPatrolsService } from "./field-patrols.service";
import { FieldPatrolHardeningService } from "./field-patrol-hardening.service";
import { FieldShiftsService } from "./field-shifts.service";
import { assertFieldSession } from "./field-session.util";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FieldSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shifts: FieldShiftsService,
    private readonly patrols: FieldPatrolsService,
    private readonly patrolHardening: FieldPatrolHardeningService,
    private readonly checkpoints: FieldCheckpointsService,
    private readonly checkpointHardening: FieldCheckpointHardeningService,
    private readonly responses: FieldOperationalResponsesService,
    private readonly bolo: FieldBoloService,
    private readonly backup: FieldBackupRequestsService,
    private readonly safety: FieldOfficerSafetyService,
  ) {}

  async syncBatch(actor: JwtPayload, dto: FieldSyncBatchDto & { generationId?: string; offlineQueueDepth?: number }) {
    const ctx = assertFieldSession(actor);
    const items = dto.items ?? [];
    if (items.length > FIELD_SYNC_MAX_BATCH_SIZE) {
      throw new BadRequestException({ code: FIELD_SYNC_ERROR_CODES.BATCH_TOO_LARGE, message: "Batch too large" });
    }

    const device = await this.prisma.fieldDevice.findUnique({ where: { id: ctx.fieldDeviceId } });
    if (!device || device.isRevoked || device.isLost) {
      throw new ConflictException({ code: FIELD_SYNC_ERROR_CODES.DEVICE_REVOKED, message: "Device revoked" });
    }

    const syncState = await this.prisma.fieldDeviceSyncState.upsert({
      where: { fieldDeviceId: ctx.fieldDeviceId },
      create: {
        fieldDeviceId: ctx.fieldDeviceId,
        officerId: ctx.officerId,
        generationId: dto.generationId ?? "default",
        offlineQueueDepth: dto.offlineQueueDepth ?? items.length,
      },
      update: {
        generationId: dto.generationId ?? undefined,
        offlineQueueDepth: dto.offlineQueueDepth ?? items.length,
        lastSyncAt: new Date(),
      },
    });

    if (dto.generationId && syncState.generationId && dto.generationId !== syncState.generationId) {
      // Allow upgrade but reject stale queued actions from older generation when explicitly mismatched in payload metadata
      const staleItems = items.filter((i) => i.payload?.generationId && i.payload.generationId !== dto.generationId);
      if (staleItems.length === items.length && items.length > 0) {
        throw new ConflictException({ code: FIELD_SYNC_ERROR_CODES.STALE_GENERATION, message: "Stale generation" });
      }
    }

    const results: Array<{
      clientActionId: string;
      ok: boolean;
      type: string;
      error?: string;
      code?: string;
    }> = [];

    for (const item of items) {
      try {
        await this.applyItem(actor, item);
        results.push({ clientActionId: item.clientActionId, ok: true, type: item.type });
      } catch (error) {
        const response = error instanceof BadRequestException || error instanceof ConflictException || error instanceof ForbiddenException
          ? (error.getResponse() as { code?: string; message?: string })
          : null;
        results.push({
          clientActionId: item.clientActionId,
          ok: false,
          type: item.type,
          error: response?.message ?? (error instanceof Error ? error.message : "Sync failed"),
          code: response?.code,
        });
      }
    }

    const applied = results.filter((r) => r.ok).length;
    const deadLetter = results.filter((r) => !r.ok).length;
    await this.prisma.fieldDeviceSyncState.update({
      where: { fieldDeviceId: ctx.fieldDeviceId },
      data: {
        syncCursor: new Date().toISOString(),
        lastSyncAt: new Date(),
        offlineQueueDepth: Math.max(0, (dto.offlineQueueDepth ?? items.length) - applied),
        deadLetterCount: { increment: deadLetter },
      },
    });

    return { data: { results, applied, deadLetter, syncCursor: new Date().toISOString() } };
  }

  private async applyItem(actor: JwtPayload, item: FieldSyncBatchDto["items"][number]) {
    switch (item.type) {
      case "shift":
        if ((item.payload.action as string) === "end") await this.shifts.endShift(actor, item.payload as never);
        else await this.shifts.startShift(actor, { ...item.payload, clientActionId: item.clientActionId } as never);
        break;
      case "patrol":
        if ((item.payload.action as string) === "location") {
          await this.patrols.recordLocation(actor, { ...item.payload, clientActionId: item.clientActionId } as never);
        } else if ((item.payload.action as string) === "event") {
          await this.patrolHardening.recordEvent(actor, { ...item.payload, clientActionId: item.clientActionId } as never);
        } else if ((item.payload.action as string) === "end") {
          await this.patrols.endPatrol(actor);
        } else {
          await this.patrols.startPatrol(actor, { ...item.payload, clientActionId: item.clientActionId } as never);
        }
        break;
      case "checkpoint":
        if ((item.payload.action as string) === "observation") {
          await this.checkpointHardening.recordObservation(actor, { ...item.payload, clientActionId: item.clientActionId } as never);
        } else if ((item.payload.action as string) === "end") {
          await this.checkpoints.endCheckpoint(actor);
        } else {
          await this.checkpoints.startCheckpoint(actor, { ...item.payload, clientActionId: item.clientActionId } as never);
        }
        break;
      case "response":
        await this.responses.recordResponse(actor, { ...item.payload, clientActionId: item.clientActionId } as never);
        break;
      case "sighting":
        await this.bolo.createSighting(actor, { ...item.payload, clientActionId: item.clientActionId } as never);
        break;
      case "patrolLocation":
        await this.patrols.recordLocation(actor, { ...item.payload, clientActionId: item.clientActionId } as never);
        break;
      case "backup":
        await this.backup.create(actor, { ...item.payload, clientActionId: item.clientActionId } as never);
        break;
      case "safety":
        await this.safety.createAlert(actor, { ...item.payload, clientActionId: item.clientActionId } as never);
        break;
      default:
        throw new BadRequestException(`Unsupported sync item type: ${item.type}`);
    }
  }
}
