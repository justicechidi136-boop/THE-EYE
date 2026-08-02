import { Injectable, Logger } from "@nestjs/common";
import { Counter, Histogram } from "prom-client";

const exportDuration = new Histogram({
  name: "the_eye_watch_export_duration_seconds",
  help: "Watch fleet export job duration in seconds",
  labelNames: ["outcome"],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1800],
});

const exportsTotal = new Counter({
  name: "the_eye_watch_exports_total",
  help: "Watch fleet export jobs by status",
  labelNames: ["status"],
});

const exportRowsTotal = new Counter({
  name: "the_eye_watch_export_rows_total",
  help: "Rows exported from watch fleet inventory",
});

const exportBytesTotal = new Counter({
  name: "the_eye_watch_export_bytes_total",
  help: "Bytes uploaded for watch fleet exports",
});

const signedUrlsTotal = new Counter({
  name: "the_eye_watch_export_signed_urls_total",
  help: "Signed download URLs issued for watch fleet exports",
  labelNames: ["outcome"],
});

const cleanupTotal = new Counter({
  name: "the_eye_watch_export_cleanup_total",
  help: "Watch fleet export cleanup operations",
  labelNames: ["outcome"],
});

@Injectable()
export class WatchExportMetrics {
  private readonly logger = new Logger(WatchExportMetrics.name);

  recordRequested() {
    exportsTotal.inc({ status: "requested" });
  }

  recordQueued() {
    exportsTotal.inc({ status: "queued" });
  }

  recordRunning() {
    exportsTotal.inc({ status: "running" });
  }

  recordCompleted(durationSeconds: number, rows: number, bytes: number) {
    exportsTotal.inc({ status: "completed" });
    exportDuration.observe({ outcome: "completed" }, durationSeconds);
    exportRowsTotal.inc(rows);
    exportBytesTotal.inc(bytes);
  }

  recordFailed(durationSeconds: number) {
    exportsTotal.inc({ status: "failed" });
    exportDuration.observe({ outcome: "failed" }, durationSeconds);
  }

  recordSignedUrl(outcome: "issued" | "denied") {
    signedUrlsTotal.inc({ outcome });
  }

  recordCleanup(outcome: "deleted" | "failed" | "skipped") {
    cleanupTotal.inc({ outcome });
  }

  logExportEvent(event: string, metadata: Record<string, unknown>) {
    this.logger.log(JSON.stringify({ component: "watch-export", event, ...metadata }));
  }
}
