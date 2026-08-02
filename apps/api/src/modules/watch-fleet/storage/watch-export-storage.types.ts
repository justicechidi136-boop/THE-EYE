import type { Readable } from "stream";

export type WatchExportStorageProvider = "local" | "s3";

export type WatchExportObjectMetadata = {
  objectKey: string;
  bucket?: string;
  contentType: string;
  fileSizeBytes: number;
  checksum?: string;
  etag?: string;
};

export type WatchExportUploadHandle = {
  objectKey: string;
  uploadId?: string;
  localPath?: string;
};

export type WatchExportStorageConfig = {
  provider: WatchExportStorageProvider;
  bucket?: string;
  signedUrlTtlSeconds: number;
  retentionHours: number;
};

export interface WatchExportStorage {
  readonly provider: WatchExportStorageProvider;
  readonly bucket?: string;

  createUpload(objectKey: string, contentType: string): Promise<WatchExportUploadHandle>;

  uploadStream(handle: WatchExportUploadHandle, stream: Readable): Promise<void>;

  uploadFile(handle: WatchExportUploadHandle, filePath: string): Promise<WatchExportObjectMetadata>;

  completeUpload(handle: WatchExportUploadHandle): Promise<WatchExportObjectMetadata>;

  abortUpload(handle: WatchExportUploadHandle): Promise<void>;

  createSignedDownloadUrl(objectKey: string, expiresSeconds?: number): Promise<string>;

  deleteObject(objectKey: string): Promise<void>;

  objectExists(objectKey: string): Promise<boolean>;

  getMetadata(objectKey: string): Promise<WatchExportObjectMetadata | null>;
}
