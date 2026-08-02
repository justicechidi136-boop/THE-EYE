import { Logger } from "@nestjs/common";
import { resolveAppEnvironment } from "../../../common/auth/firebase-environment";
import { isProductionLikeAppEnvironment } from "../../../common/queue/queue-config";
import { LocalWatchExportStorage } from "./local-watch-export-storage";
import { S3WatchExportStorage } from "./s3-watch-export-storage";
import type { WatchExportStorage, WatchExportStorageProvider } from "./watch-export-storage.types";

const logger = new Logger("WatchExportStorageConfig");

export function resolveWatchExportStorageProvider(
  config: Record<string, unknown> = process.env as Record<string, unknown>,
): WatchExportStorageProvider {
  const raw = String(config.WATCH_EXPORT_STORAGE_PROVIDER ?? "local").trim().toLowerCase();
  if (raw === "s3") return "s3";
  return "local";
}

export function resolveWatchExportRetentionHours(
  config: Record<string, unknown> = process.env as Record<string, unknown>,
): number {
  const hours = Number(config.WATCH_EXPORT_RETENTION_HOURS ?? 24);
  return Number.isFinite(hours) && hours > 0 ? hours : 24;
}

export function resolveWatchExportSignedUrlTtlSeconds(
  config: Record<string, unknown> = process.env as Record<string, unknown>,
): number {
  const ttl = Number(config.WATCH_EXPORT_SIGNED_URL_TTL_SECONDS ?? 900);
  return Number.isFinite(ttl) && ttl >= 60 && ttl <= 3600 ? ttl : 900;
}

export function assertWatchExportStorageConfiguration(
  config: Record<string, unknown> = process.env as Record<string, unknown>,
) {
  const provider = resolveWatchExportStorageProvider(config);
  const appEnv = resolveAppEnvironment(config);

  if (provider === "local") {
    const emergencyOverride =
      config.WATCH_EXPORT_ALLOW_LOCAL_IN_PRODUCTION === "1" ||
      config.WATCH_EXPORT_ALLOW_LOCAL_IN_PRODUCTION === 1;

    if (appEnv === "production" && !emergencyOverride) {
      throw new Error(
        "WATCH_EXPORT_STORAGE_PROVIDER=local is not allowed in production. Use s3 or set WATCH_EXPORT_ALLOW_LOCAL_IN_PRODUCTION=1 for emergency override only.",
      );
    }

    if (appEnv === "staging") {
      logger.warn(
        "Watch export storage is using local disk in staging. Configure WATCH_EXPORT_STORAGE_PROVIDER=s3 for production-like staging.",
      );
    }
  }

  if (provider === "s3") {
    const endpoint = String(config.WATCH_EXPORT_S3_ENDPOINT ?? config.S3_ENDPOINT ?? "").trim();
    const bucket = String(config.WATCH_EXPORT_S3_BUCKET ?? config.S3_BUCKET ?? "").trim();
    const accessKey = String(config.WATCH_EXPORT_S3_ACCESS_KEY_ID ?? config.S3_ACCESS_KEY ?? "").trim();
    const secretKey = String(config.WATCH_EXPORT_S3_SECRET_ACCESS_KEY ?? config.S3_SECRET_KEY ?? "").trim();
    if (!endpoint || !bucket || !accessKey || !secretKey) {
      throw new Error(
        "WATCH_EXPORT_STORAGE_PROVIDER=s3 requires WATCH_EXPORT_S3_* (or fallback S3_*) credentials and bucket configuration",
      );
    }
  }
}

export function createWatchExportStorage(
  config: Record<string, unknown> = process.env as Record<string, unknown>,
): WatchExportStorage {
  const provider = resolveWatchExportStorageProvider(config);
  if (provider === "s3") return new S3WatchExportStorage(config);
  return new LocalWatchExportStorage();
}

export function isLocalWatchExportStorage(storage: WatchExportStorage): storage is LocalWatchExportStorage {
  return storage.provider === "local";
}
