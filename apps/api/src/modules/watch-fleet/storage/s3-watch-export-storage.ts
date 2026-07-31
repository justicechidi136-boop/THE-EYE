import { promises as fs } from "fs";
import type { Readable } from "stream";
import type {
  WatchExportObjectMetadata,
  WatchExportStorage,
  WatchExportUploadHandle,
} from "./watch-export-storage.types";
import {
  createWatchExportPresignedGetUrl,
  deleteWatchExportObject,
  headWatchExportObject,
  putWatchExportObjectFromFile,
  resolveWatchExportS3Config,
  type WatchExportS3Config,
} from "./watch-export-s3-client";

export class S3WatchExportStorage implements WatchExportStorage {
  readonly provider = "s3" as const;
  readonly bucket: string;
  private readonly config: WatchExportS3Config;
  private readonly signedUrlTtlSeconds: number;
  private readonly stagingPaths = new Map<string, string>();

  constructor(config: Record<string, unknown> = process.env as Record<string, unknown>) {
    this.config = resolveWatchExportS3Config(config);
    this.bucket = this.config.bucket;
    this.signedUrlTtlSeconds = Number(config.WATCH_EXPORT_SIGNED_URL_TTL_SECONDS ?? 900);
  }

  async createUpload(objectKey: string, _contentType: string): Promise<WatchExportUploadHandle> {
    return { objectKey };
  }

  async uploadStream(handle: WatchExportUploadHandle, stream: Readable): Promise<void> {
    const { streamToFile } = await import("./watch-export-s3-client");
    const { mkdtemp } = await import("fs/promises");
    const { join } = await import("path");
    const { tmpdir } = await import("os");
    const dir = await mkdtemp(join(tmpdir(), "watch-export-"));
    const filePath = join(dir, "export.csv");
    await streamToFile(stream, filePath);
    this.stagingPaths.set(handle.objectKey, filePath);
  }

  async uploadFile(handle: WatchExportUploadHandle, filePath: string): Promise<WatchExportObjectMetadata> {
    this.stagingPaths.set(handle.objectKey, filePath);
    return this.completeUpload(handle);
  }

  async completeUpload(handle: WatchExportUploadHandle): Promise<WatchExportObjectMetadata> {
    const filePath = this.stagingPaths.get(handle.objectKey);
    if (!filePath) throw new Error("S3 upload staging file missing");
    const metadata = await putWatchExportObjectFromFile(this.config, handle.objectKey, filePath, "text/csv");
    this.stagingPaths.delete(handle.objectKey);
    await fs.unlink(filePath).catch(() => undefined);
    return metadata;
  }

  async abortUpload(handle: WatchExportUploadHandle): Promise<void> {
    const filePath = this.stagingPaths.get(handle.objectKey);
    if (filePath) {
      this.stagingPaths.delete(handle.objectKey);
      await fs.unlink(filePath).catch(() => undefined);
    }
    if (handle.uploadId) {
      const { abortWatchExportMultipartUpload } = await import("./watch-export-s3-client");
      await abortWatchExportMultipartUpload(this.config, handle.objectKey, handle.uploadId).catch(() => undefined);
    }
  }

  async createSignedDownloadUrl(objectKey: string, expiresSeconds?: number): Promise<string> {
    return createWatchExportPresignedGetUrl(
      this.config,
      objectKey,
      expiresSeconds ?? this.signedUrlTtlSeconds,
    );
  }

  async deleteObject(objectKey: string): Promise<void> {
    await deleteWatchExportObject(this.config, objectKey);
  }

  async objectExists(objectKey: string): Promise<boolean> {
    const metadata = await headWatchExportObject(this.config, objectKey);
    return metadata !== null;
  }

  async getMetadata(objectKey: string): Promise<WatchExportObjectMetadata | null> {
    return headWatchExportObject(this.config, objectKey);
  }
}
