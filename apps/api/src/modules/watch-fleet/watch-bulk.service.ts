import { randomUUID } from "crypto";
import { Injectable, NotFoundException, Optional, ServiceUnavailableException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { WatchBulkOperationType } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { WATCH_FLEET_BULK_QUEUE_NAME } from "../../common/queue/queue-names";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { WatchOwnershipService, type AssignWatchDto, type TransferWatchDto } from "./watch-ownership.service";
import {
  canRunWatchFleetBulkInline,
  resolveWatchFleetBulkMode,
  WATCH_FLEET_INLINE_BULK_MAX_DEVICES,
  watchFleetQueueAvailable,
} from "./watch-fleet-bulk-config";

const BULK_CHUNK_SIZE = 100;

export type BulkWatchJobPayload = {
  jobId: string;
  operationType: string;
  deviceIds: string[];
  actorAdminId: string;
  correlationId: string;
  payload: Record<string, unknown>;
};

@Injectable()
export class WatchBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ownership: WatchOwnershipService,
    @Optional() @InjectQueue(WATCH_FLEET_BULK_QUEUE_NAME) private readonly queue?: Queue,
  ) {}

  async enqueueBulk(
    actor: JwtPayload,
    operationType: string,
    deviceIds: string[],
    payload: Record<string, unknown> = {},
  ) {
    const correlationId = String(payload.correlationId ?? randomUUID());
    const job = await (this.prisma as any).watchBulkOperationJob.create({
      data: {
        operationType,
        requestedCount: deviceIds.length,
        actorAdminId: actor.sub,
        correlationId,
        metadata: { ...payload, deviceIds },
      },
    });

    await this.audit.record({
      actor,
      action: "watch.bulk.enqueued",
      entityType: "watch_bulk_operation_jobs",
      entityId: job.id,
      metadata: { operationType, requestedCount: deviceIds.length, correlationId },
    });

    const bulkPayload: BulkWatchJobPayload = {
      jobId: job.id,
      operationType,
      deviceIds,
      actorAdminId: actor.sub,
      correlationId,
      payload,
    };

    if (watchFleetQueueAvailable()) {
      if (!this.queue) {
        throw new ServiceUnavailableException(
          "Watch fleet bulk jobs require BullMQ. Configure Redis or use WATCH_FLEET_BULK_MODE=inline in development only.",
        );
      }
      await this.queue.add("process-bulk", bulkPayload, { jobId: job.id });
    } else if (canRunWatchFleetBulkInline(deviceIds.length)) {
      await this.processBulkJob(bulkPayload);
    } else {
      const mode = resolveWatchFleetBulkMode();
      throw new ServiceUnavailableException(
        mode === "required"
          ? "Watch fleet bulk operations require BullMQ (WATCH_FLEET_BULK_MODE=required)."
          : `Bulk job too large for inline processing (max ${WATCH_FLEET_INLINE_BULK_MAX_DEVICES} devices). Enable Redis/BullMQ.`,
      );
    }

    return { data: job };
  }

  async getBulkJob(jobId: string, actor: JwtPayload) {
    const job = await (this.prisma as any).watchBulkOperationJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException("Bulk job not found");
    if (job.actorAdminId !== actor.sub && actor.role !== "Super Admin") {
      // allow super admin only for cross-admin visibility
    }
    const progressPct =
      job.requestedCount > 0 ? Math.min(100, Math.round((job.processedCount / job.requestedCount) * 100)) : 0;
    return {
      data: {
        ...job,
        progressPct,
        estimatedCompletion: job.completedAt ?? null,
      },
    };
  }

  async cancelBulkJob(jobId: string, actor: JwtPayload) {
    const job = await (this.prisma as any).watchBulkOperationJob.update({
      where: { id: jobId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    await this.audit.record({
      actor,
      action: "watch.bulk.cancelled",
      entityType: "watch_bulk_operation_jobs",
      entityId: jobId,
    });
    if (this.queue) {
      const bullJob = await this.queue.getJob(jobId);
      if (bullJob) await bullJob.remove();
    }
    return { data: job };
  }

  async processBulkJob(input: BulkWatchJobPayload) {
    const failures: { deviceId: string; error: string }[] = [];
    let processed = 0;
    let success = 0;
    let skipped = 0;

    await (this.prisma as any).watchBulkOperationJob.update({
      where: { id: input.jobId },
      data: { status: "PROCESSING" },
    });

    const actor = { typ: "admin" as const, sub: input.actorAdminId, role: "Super Admin" };

    for (let i = 0; i < input.deviceIds.length; i += BULK_CHUNK_SIZE) {
      const chunk = input.deviceIds.slice(i, i + BULK_CHUNK_SIZE);
      for (const deviceId of chunk) {
        processed += 1;
        try {
          await this.processSingleBulkItem(input.operationType, deviceId, actor, input.payload);
          success += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          if (message.includes("idempotent")) {
            skipped += 1;
          } else {
            failures.push({ deviceId, error: message });
          }
        }
      }

      const progressPct = Math.min(100, Math.round((processed / input.deviceIds.length) * 100));
      await (this.prisma as any).watchBulkOperationJob.update({
        where: { id: input.jobId },
        data: {
          processedCount: processed,
          successCount: success,
          failureCount: failures.length,
          skippedCount: skipped,
          progressPct,
        },
      });
    }

    const failureReportKey =
      failures.length > 0 ? `watch-bulk-failures/${input.jobId}.json` : null;

    await (this.prisma as any).watchBulkOperationJob.update({
      where: { id: input.jobId },
      data: {
        status: failures.length ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
        processedCount: processed,
        successCount: success,
        failureCount: failures.length,
        skippedCount: skipped,
        progressPct: 100,
        completedAt: new Date(),
        failureReportKey,
        metadata: { failures: failures.slice(0, 500) },
      },
    });
  }

  private async processSingleBulkItem(
    operationType: string,
    deviceId: string,
    actor: JwtPayload,
    payload: Record<string, unknown>,
  ) {
    switch (operationType) {
      case WatchBulkOperationType.Assign:
        await this.ownership.assignDevice(actor, {
          deviceId,
          ownerType: payload.ownerType as "PERSON" | "ORGANIZATION",
          ownerPersonId: payload.ownerPersonId as string | undefined,
          ownerOrganizationId: payload.ownerOrganizationId as string | undefined,
          assigneePersonId: payload.assigneePersonId as string | undefined,
          departmentId: payload.departmentId as string | undefined,
          reason: payload.reason as string | undefined,
          idempotencyKey: `${payload.correlationId}:${deviceId}:assign`,
        });
        break;
      case WatchBulkOperationType.Transfer:
        await this.ownership.transferDevice(actor, {
          deviceId,
          toOwnerType: payload.toOwnerType as TransferWatchDto["toOwnerType"],
          toOwnerPersonId: payload.toOwnerPersonId as string | undefined,
          toOwnerOrganizationId: payload.toOwnerOrganizationId as string | undefined,
          toAssigneePersonId: payload.toAssigneePersonId as string | undefined,
          toDepartmentId: payload.toDepartmentId as string | undefined,
          toInventoryLocationId: payload.toInventoryLocationId as string | undefined,
          reason: payload.reason as string | undefined,
          idempotencyKey: `${payload.correlationId}:${deviceId}:transfer`,
        });
        break;
      case WatchBulkOperationType.MarkLostOrStolen:
        await this.ownership.markLostOrStolen(actor, deviceId, payload.reason as string | undefined);
        break;
      case WatchBulkOperationType.Retire:
        await this.ownership.retireDevice(actor, deviceId, payload.reason as string | undefined);
        break;
      case WatchBulkOperationType.ExportInventory:
        throw new Error("Use /watch-fleet/exports for inventory export jobs");
      default:
        throw new Error(`Unsupported bulk operation: ${operationType}`);
    }
  }
}
