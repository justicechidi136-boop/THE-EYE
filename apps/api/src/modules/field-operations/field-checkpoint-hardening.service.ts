import { BadRequestException, Injectable } from "@nestjs/common";
import { FieldCheckpointObservationType, FieldOperationalEventType } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { FieldEventsService } from "./field-events.service";
import { assertFieldSession, decimalOrNull } from "./field-session.util";

@Injectable()
export class FieldCheckpointHardeningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: FieldEventsService,
  ) {}

  async recordObservation(
    actor: JwtPayload,
    dto: {
      observationType: FieldCheckpointObservationType;
      searchQuery?: string;
      matchBroadcastId?: string;
      latitude?: number;
      longitude?: number;
      evidenceReference?: string;
      clientActionId?: string;
    },
  ) {
    const ctx = assertFieldSession(actor);
    const session = await this.prisma.checkpointSession.findFirst({
      where: { officerId: ctx.officerId, status: { in: ["Active", "Paused"] } },
    });
    if (!session) throw new BadRequestException("Active checkpoint session required");

    if (dto.clientActionId) {
      const dup = await this.prisma.fieldCheckpointObservation.findUnique({ where: { clientActionId: dto.clientActionId } });
      if (dup) return { data: dup };
    }

    const observation = await this.prisma.fieldCheckpointObservation.create({
      data: {
        checkpointSessionId: session.id,
        officerId: ctx.officerId,
        observationType: dto.observationType,
        searchQuery: dto.searchQuery?.trim() || null,
        matchBroadcastId: dto.matchBroadcastId ?? null,
        latitude: decimalOrNull(dto.latitude),
        longitude: decimalOrNull(dto.longitude),
        evidenceReference: dto.evidenceReference?.trim() || null,
        clientActionId: dto.clientActionId ?? null,
        metadata: { retentionPolicy: "operational-minimal" },
      },
    });

    if (dto.matchBroadcastId && ctx.agencyId) {
      await this.events.publish({
        agencyId: ctx.agencyId,
        officerId: ctx.officerId,
        fieldDeviceId: ctx.fieldDeviceId,
        eventType: FieldOperationalEventType.BoloMatch,
        entityType: "field_checkpoint_observations",
        entityId: observation.id,
        payload: { broadcastId: dto.matchBroadcastId },
      });
    }

    await this.audit.record({
      actor,
      action: "field.checkpoint.observation",
      entityType: "field_checkpoint_observations",
      entityId: observation.id,
      metadata: { observationType: dto.observationType, searchQuery: dto.searchQuery },
    });

    return { data: observation };
  }

  async closureSummary(actor: JwtPayload) {
    const ctx = assertFieldSession(actor);
    const session = await this.prisma.checkpointSession.findFirst({
      where: { officerId: ctx.officerId, status: { in: ["Active", "Paused", "Ended"] } },
      orderBy: { startedAt: "desc" },
      include: { checkpointObservations: { orderBy: { createdAt: "desc" }, take: 100 } },
    });
    if (!session) throw new BadRequestException("No checkpoint session");
    return {
      data: {
        sessionId: session.id,
        checkpointName: session.checkpointName,
        queueCount: session.queueCount,
        vehicleChecks: session.vehicleChecks,
        observationCount: session.checkpointObservations.length,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
      },
    };
  }
}
