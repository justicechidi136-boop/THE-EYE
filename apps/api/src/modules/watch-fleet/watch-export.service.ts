import { createHmac, randomUUID } from "crypto";
import { createWriteStream, promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type { JwtPayload } from "../../common/auth/jwt";
import { adminCanAccessGeography, adminGeographyWhere } from "../../common/auth/admin-geography-scope";
import { resolveAppEnvironment } from "../../common/auth/firebase-environment";
import { decodeDateIdCursor, encodeDateIdCursor } from "../../common/pagination/cursor-pagination";
import { WATCH_FLEET_EXPORT_QUEUE_NAME } from "../../common/queue/queue-names";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { canViewWatchSensitiveFields, maskImei } from "./watch-fleet-scope";
import { buildGeographyDeviceWhere } from "./watch-fleet-geography";
import {
  canRunWatchFleetExportInline,
  watchFleetQueueAvailable,
} from "./watch-fleet-bulk-config";
import type { WatchInventoryQuery } from "./watch-fleet.service";
import { WatchExportMetrics } from "./watch-export-metrics";
import { buildWatchExportObjectKey } from "./storage/watch-export-s3-client";
import {
  createWatchExportStorage,
  isLocalWatchExportStorage,
  resolveWatchExportRetentionHours,
  resolveWatchExportSignedUrlTtlSeconds,
  resolveWatchExportStorageProvider,
} from "./storage/watch-export-storage.config";
import type { WatchExportStorage } from "./storage/watch-export-storage.types";

const EXPORT_BATCH_SIZE = 500;
const EXPORT_CONTENT_TYPE = "text/csv";

export type WatchExportJobPayload = {
  exportJobId: string;
  actorAdminId: string;
  actorRole?: string;
  geographyScope: ReturnType<typeof adminGeographyWhere>;
  filters: Record<string, unknown>;
  correlationId: string;
  maskSensitive: boolean;
};

@Injectable()
export class WatchExportService {
  private readonly storage: WatchExportStorage;
  private readonly retentionHours: number;
  private readonly signedUrlTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly metrics: WatchExportMetrics,
    @Optional() @InjectQueue(WATCH_FLEET_EXPORT_QUEUE_NAME) private readonly queue?: Queue,
  ) {
    this.storage = createWatchExportStorage();
    this.retentionHours = resolveWatchExportRetentionHours();
    this.signedUrlTtlSeconds = resolveWatchExportSignedUrlTtlSeconds();
  }

  async requestExport(actor: JwtPayload, filters: WatchInventoryQuery = {}) {
    if (actor.typ !== "admin") throw new NotFoundException("Admin access required");

    const correlationId = randomUUID();
    const geographyScope = adminGeographyWhere(actor);
    const maskSensitive = !canViewWatchSensitiveFields(actor);
    const expiresAt = new Date(Date.now() + this.retentionHours * 60 * 60 * 1000);

    const job = await (this.prisma as any).watchExportJob.create({
      data: {
        requestedByAdminId: actor.sub,
        actorRole: actor.role ?? null,
        geographyScope: geographyScope ?? {},
        filters: filters as Record<string, unknown>,
        status: "QUEUED",
        correlationId,
        expiresAt,
        maskSensitive,
        storageProvider: resolveWatchExportStorageProvider(),
      },
    });

    this.metrics.recordRequested();
    await this.audit.record({
      actor,
      action: "watch.export.requested",
      entityType: "watch_export_jobs",
      entityId: job.id,
      metadata: { correlationId, filters },
    });

    const payload: WatchExportJobPayload = {
      exportJobId: job.id,
      actorAdminId: actor.sub,
      actorRole: actor.role,
      geographyScope,
      filters: filters as Record<string, unknown>,
      correlationId,
      maskSensitive,
    };

    if (watchFleetQueueAvailable()) {
      if (!this.queue) {
        throw new ServiceUnavailableException(
          "Watch fleet export requires BullMQ. Configure Redis or set WATCH_FLEET_BULK_MODE=inline for development only.",
        );
      }
      await this.queue.add("process-export", payload, { jobId: job.id });
      this.metrics.recordQueued();
    } else if (canRunWatchFleetExportInline()) {
      await this.processExportJob(payload);
    } else {
      throw new ServiceUnavailableException(
        "Watch fleet export requires BullMQ in staging and production environments.",
      );
    }

    return { data: job };
  }

  async getExportJob(exportJobId: string, actor: JwtPayload) {
    const job = await (this.prisma as any).watchExportJob.findUnique({ where: { id: exportJobId } });
    if (!job) throw new NotFoundException("Export job not found");
    if (job.requestedByAdminId !== actor.sub && actor.role !== "Super Admin") {
      throw new NotFoundException("Export job not found");
    }
    return { data: job };
  }

  async cancelExportJob(exportJobId: string, actor: JwtPayload) {
    const job = await (this.prisma as any).watchExportJob.update({
      where: { id: exportJobId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    await this.audit.record({
      actor,
      action: "watch.export.cancelled",
      entityType: "watch_export_jobs",
      entityId: exportJobId,
    });
    if (this.queue) {
      const bullJob = await this.queue.getJob(exportJobId);
      if (bullJob) await bullJob.remove();
    }
    return { data: job };
  }

  createDownloadToken(exportJobId: string, storageKey: string, expiresAt: Date) {
    const secret = String(process.env.JWT_ACCESS_SECRET ?? "dev-export-secret");
    const expiresAtMs = String(expiresAt.getTime());
    const payload = `${exportJobId}|${storageKey}|${expiresAtMs}`;
    const sig = createHmac("sha256", secret).update(payload).digest("base64url");
    return Buffer.from(`${payload}|${sig}`).toString("base64url");
  }

  verifyDownloadToken(token: string) {
    const secret = String(process.env.JWT_ACCESS_SECRET ?? "dev-export-secret");
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split("|");
    if (parts.length !== 4) throw new NotFoundException("Invalid download token");
    const [exportJobId, storageKey, expiresAtMs, sig] = parts;
    const payload = `${exportJobId}|${storageKey}|${expiresAtMs}`;
    const expected = createHmac("sha256", secret).update(payload).digest("base64url");
    if (sig !== expected) throw new NotFoundException("Invalid download token");
    const expiresAt = new Date(Number(expiresAtMs));
    if (expiresAt.getTime() < Date.now()) throw new NotFoundException("Download link expired");
    return { exportJobId, storageKey, expiresAt };
  }

  assertExportDownloadAuthorized(actor: JwtPayload, job: Record<string, unknown>) {
    if (job.requestedByAdminId !== actor.sub && actor.role !== "Super Admin") {
      throw new NotFoundException("Export job not found");
    }

    const jobScope = (job.geographyScope ?? {}) as Record<string, string | undefined>;
    if (!adminCanAccessGeography(jobScope, actor)) {
      throw new ForbiddenException("Export geography scope is outside your admin jurisdiction");
    }

    const status = String(job.status ?? "");

    if (job.cancelledAt || status === "CANCELLED") {
      throw new NotFoundException("Export was cancelled");
    }

    if (status === "FAILED") {
      throw new NotFoundException("Export failed");
    }

    if (job.deletedAt || status === "DELETED" || status === "EXPIRED") {
      throw new NotFoundException("Export has expired or been deleted");
    }

    if (status !== "READY") {
      throw new NotFoundException("Export is not ready for download");
    }

    if (new Date(String(job.expiresAt)).getTime() < Date.now()) {
      throw new NotFoundException("Export has expired");
    }

    if (!job.storageKey) {
      throw new NotFoundException("Export file unavailable");
    }
  }

  async issueDownloadUrl(exportJobId: string, actor: JwtPayload) {
    const jobResult = await this.getExportJob(exportJobId, actor);
    const job = jobResult.data as Record<string, unknown>;

    try {
      this.assertExportDownloadAuthorized(actor, job);
    } catch (error) {
      this.metrics.recordSignedUrl("denied");
      throw error;
    }

    const storageKey = String(job.storageKey);
    const provider = String(job.storageProvider ?? resolveWatchExportStorageProvider());

    if (provider === "s3") {
      const exists = await this.storage.objectExists(storageKey);
      if (!exists) {
        this.metrics.recordSignedUrl("denied");
        throw new NotFoundException("Export file no longer available in storage");
      }

      const downloadUrl = await this.storage.createSignedDownloadUrl(storageKey, this.signedUrlTtlSeconds);
      const urlExpiresAt = new Date(Date.now() + this.signedUrlTtlSeconds * 1000);

      await this.audit.record({
        actor,
        action: "watch.export.download_issued",
        entityType: "watch_export_jobs",
        entityId: exportJobId,
        metadata: { storageProvider: "s3", urlExpiresAt: urlExpiresAt.toISOString() },
      });

      this.metrics.recordSignedUrl("issued");
      this.metrics.logExportEvent("signed_url_issued", {
        exportJobId,
        storageProvider: "s3",
        fileSizeBytes: job.fileSizeBytes,
        totalRows: job.totalRows,
      });

      return {
        data: {
          downloadUrl,
          expiresAt: urlExpiresAt.toISOString(),
          exportExpiresAt: job.expiresAt,
          fileSizeBytes: job.fileSizeBytes,
          totalRows: job.totalRows,
          storageProvider: "s3",
        },
      };
    }

    const token = this.createDownloadToken(exportJobId, storageKey, new Date(String(job.expiresAt)));
    await this.audit.record({
      actor,
      action: "watch.export.download_issued",
      entityType: "watch_export_jobs",
      entityId: exportJobId,
      metadata: { storageProvider: "local" },
    });
    this.metrics.recordSignedUrl("issued");

    return {
      data: {
        downloadUrl: `/watch-fleet/exports/${exportJobId}/download?token=${encodeURIComponent(token)}`,
        expiresAt: job.expiresAt,
        fileSizeBytes: job.fileSizeBytes,
        totalRows: job.totalRows,
        storageProvider: "local",
      },
    };
  }

  resolveLocalDownloadPath(storageKey: string) {
    if (!isLocalWatchExportStorage(this.storage)) {
      throw new NotFoundException("Local download is not available for S3-backed exports");
    }
    return this.storage.resolveLocalPath(storageKey);
  }

  async processExportJob(input: WatchExportJobPayload) {
    const startedAt = Date.now();
    const startedAtDate = new Date();
    this.metrics.recordRunning();

    await (this.prisma as any).watchExportJob.update({
      where: { id: input.exportJobId },
      data: { status: "PROCESSING", startedAt: startedAtDate },
    });

    const environment = resolveAppEnvironment(process.env as Record<string, unknown>);
    const objectKey = buildWatchExportObjectKey(environment, input.exportJobId, startedAtDate);
    const uploadHandle = await this.storage.createUpload(objectKey, EXPORT_CONTENT_TYPE);

    const tmpDir = path.join(os.tmpdir(), "the-eye-watch-exports");
    await fs.mkdir(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `${input.exportJobId}.csv`);
    const stream = createWriteStream(filePath, { encoding: "utf8" });
    stream.write(
      "deviceId,serialNumber,imei,eid,ownershipStatus,inventoryStatus,onlineStatus,batteryLevel,lastSeen\n",
    );

    let cursor: string | null = null;
    let processedRows = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        const cancelled = await (this.prisma as any).watchExportJob.findUnique({
          where: { id: input.exportJobId },
          select: { status: true },
        });
        if (cancelled?.status === "CANCELLED") {
          stream.end();
          await this.storage.abortUpload(uploadHandle);
          return;
        }

        const batch = await this.fetchExportBatch(input, cursor, EXPORT_BATCH_SIZE);
        for (const row of batch.data) {
          stream.write(`${this.csvEscape(row.deviceId)},${this.csvEscape(row.serialNumber)},${this.csvEscape(row.imei)},${this.csvEscape(row.eid)},${this.csvEscape(row.ownershipStatus)},${this.csvEscape(row.inventoryStatus)},${this.csvEscape(row.onlineStatus)},${row.batteryLevel ?? ""},${row.lastSeen ?? ""}\n`);
        }
        processedRows += batch.data.length;
        hasMore = batch.hasMore;
        cursor = batch.nextCursor;

        const progressPct = batch.totalEstimate
          ? Math.min(99, Math.round((processedRows / batch.totalEstimate) * 100))
          : Math.min(99, processedRows > 0 ? 50 : 0);

        await (this.prisma as any).watchExportJob.update({
          where: { id: input.exportJobId },
          data: { processedRows, progressPercentage: progressPct },
        });
      }

      await new Promise<void>((resolve, reject) => {
        stream.end(() => resolve());
        stream.on("error", reject);
      });

      const metadata = await this.storage.uploadFile(uploadHandle, filePath);
      const localFilePath = isLocalWatchExportStorage(this.storage)
        ? this.storage.resolveLocalPath(objectKey)
        : null;

      await (this.prisma as any).watchExportJob.update({
        where: { id: input.exportJobId },
        data: {
          status: "READY",
          completedAt: new Date(),
          processedRows,
          totalRows: processedRows,
          successRows: processedRows,
          progressPercentage: 100,
          storageProvider: this.storage.provider,
          storageKey: objectKey,
          bucket: metadata.bucket ?? this.storage.bucket ?? null,
          contentType: metadata.contentType,
          checksum: metadata.checksum ?? null,
          localFilePath,
          fileSizeBytes: metadata.fileSizeBytes,
        },
      });

      const durationSeconds = (Date.now() - startedAt) / 1000;
      this.metrics.recordCompleted(durationSeconds, processedRows, metadata.fileSizeBytes);
      this.metrics.logExportEvent("export_completed", {
        exportJobId: input.exportJobId,
        rows: processedRows,
        bytes: metadata.fileSizeBytes,
        storageProvider: this.storage.provider,
      });

      if (!isLocalWatchExportStorage(this.storage)) {
        await fs.unlink(filePath).catch(() => undefined);
      }
    } catch (error) {
      await this.storage.abortUpload(uploadHandle).catch(() => undefined);
      await fs.unlink(filePath).catch(() => undefined);
      const durationSeconds = (Date.now() - startedAt) / 1000;
      this.metrics.recordFailed(durationSeconds);
      await (this.prisma as any).watchExportJob.update({
        where: { id: input.exportJobId },
        data: {
          status: "FAILED",
          failureReason: error instanceof Error ? error.message.slice(0, 500) : "Export failed",
        },
      });
      throw error;
    }
  }

  private async fetchExportBatch(input: WatchExportJobPayload, cursor: string | null, limit: number) {
    const where: Record<string, unknown> = {};
    const filters = input.filters;
    if (filters.ownerType) where.currentOwnerType = filters.ownerType;
    if (filters.ownerId) where.currentOwnerId = filters.ownerId;
    if (filters.organizationId) where.currentOrganizationId = filters.organizationId;
    if (filters.ownershipStatus) where.ownershipStatus = filters.ownershipStatus;
    if (filters.inventoryStatus) where.inventoryStatus = filters.inventoryStatus;
    if (filters.onlineStatus === "online") where.isOnline = true;
    if (filters.onlineStatus === "offline") where.isOnline = false;

    const geoWhere = buildGeographyDeviceWhere(input.geographyScope);
    if (geoWhere) {
      where.AND = [geoWhere];
    }

    const decoded = decodeDateIdCursor(cursor ?? undefined);
    if (decoded) {
      const createdAt = new Date(decoded.createdAt);
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        { OR: [{ lastSeenAt: { lt: createdAt } }, { lastSeenAt: createdAt, id: { lt: decoded.id } }] },
      ];
    }

    const rows = await this.prisma.smartwatchDevice.findMany({
      where: where as never,
      select: {
        id: true,
        deviceId: true,
        serialNumber: true,
        imei: true,
        eid: true,
        ownershipStatus: true,
        inventoryStatus: true,
        isOnline: true,
        batteryLevel: true,
        lastSeenAt: true,
      },
      orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const data = (hasMore ? rows.slice(0, limit) : rows).map((device) => ({
      deviceId: device.deviceId,
      serialNumber: device.serialNumber,
      imei: maskImei(device.imei, !input.maskSensitive),
      eid: maskImei(device.eid, !input.maskSensitive),
      ownershipStatus: device.ownershipStatus,
      inventoryStatus: device.inventoryStatus,
      onlineStatus: device.isOnline ? "Online" : "Offline",
      batteryLevel: device.batteryLevel,
      lastSeen: device.lastSeenAt?.toISOString() ?? null,
    }));

    const last = rows[Math.min(limit, rows.length) - 1];
    return {
      data,
      hasMore,
      nextCursor: hasMore && last ? encodeDateIdCursor(last.lastSeenAt ?? new Date(), last.id) : null,
      totalEstimate: null as number | null,
    };
  }

  private csvEscape(value: string | null | undefined) {
    const text = value ?? "";
    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }
}
