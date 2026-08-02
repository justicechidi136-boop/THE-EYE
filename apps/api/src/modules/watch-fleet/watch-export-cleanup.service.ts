import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import { PrismaService } from "../prisma/prisma.service";
import { WatchExportMetrics } from "./watch-export-metrics";
import { createWatchExportStorage } from "./storage/watch-export-storage.config";

const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 50;

@Injectable()
export class WatchExportCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WatchExportCleanupService.name);
  private readonly storage = createWatchExportStorage();
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: WatchExportMetrics,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (!shouldRegisterBullMq({
      THE_EYE_DISABLE_REDIS: this.config.get("THE_EYE_DISABLE_REDIS"),
    })) {
      return;
    }
    void this.runCleanup("startup");
    this.timer = setInterval(() => void this.runCleanup("interval"), CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runCleanup(reason: string) {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const expired = await (this.prisma as any).watchExportJob.findMany({
        where: {
          expiresAt: { lt: now },
          status: { in: ["READY", "FAILED", "CANCELLED"] },
          deletedAt: null,
        },
        take: CLEANUP_BATCH_SIZE,
        orderBy: { expiresAt: "asc" },
      });

      for (const job of expired) {
        await this.cleanupJob(job, reason);
      }

      this.metrics.logExportEvent("cleanup_cycle_complete", {
        reason,
        processed: expired.length,
      });
    } finally {
      this.running = false;
    }
  }

  private async cleanupJob(job: Record<string, unknown>, reason: string) {
    const exportJobId = String(job.id);
    const storageKey = job.storageKey ? String(job.storageKey) : null;

    if (job.status === "PROCESSING" || job.status === "QUEUED") {
      this.metrics.recordCleanup("skipped");
      return;
    }

    try {
      if (storageKey) {
        const exists = await this.storage.objectExists(storageKey);
        if (exists) {
          await this.storage.deleteObject(storageKey);
        }
      }

      await (this.prisma as any).watchExportJob.update({
        where: { id: exportJobId },
        data: {
          status: "EXPIRED",
          deletedAt: new Date(),
          deletionFailureReason: null,
          localFilePath: null,
        },
      });

      this.metrics.recordCleanup("deleted");
      this.metrics.logExportEvent("export_cleaned_up", { exportJobId, reason, storageKey });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Cleanup failed";
      await (this.prisma as any).watchExportJob.update({
        where: { id: exportJobId },
        data: { deletionFailureReason: message },
      });
      this.metrics.recordCleanup("failed");
      this.logger.warn(`Watch export cleanup failed for ${exportJobId}: ${message}`);
    }
  }
}
