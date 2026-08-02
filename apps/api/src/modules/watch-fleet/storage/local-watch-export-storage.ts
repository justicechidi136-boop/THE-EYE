import { createReadStream, createWriteStream, promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import type { Readable } from "stream";
import { createHash } from "crypto";
import type {
  WatchExportObjectMetadata,
  WatchExportStorage,
  WatchExportUploadHandle,
} from "./watch-export-storage.types";

export class LocalWatchExportStorage implements WatchExportStorage {
  readonly provider = "local" as const;
  readonly bucket = undefined;
  private readonly rootDir: string;

  constructor(rootDir = path.join(os.tmpdir(), "the-eye-watch-exports")) {
    this.rootDir = rootDir;
  }

  async createUpload(objectKey: string, _contentType: string): Promise<WatchExportUploadHandle> {
    await fs.mkdir(this.rootDir, { recursive: true });
    const localPath = path.join(this.rootDir, path.basename(objectKey));
    return { objectKey, localPath };
  }

  async uploadStream(handle: WatchExportUploadHandle, stream: Readable): Promise<void> {
    if (!handle.localPath) throw new Error("Local upload handle missing localPath");
    await new Promise<void>((resolve, reject) => {
      const writer = createWriteStream(handle.localPath!);
      stream.pipe(writer);
      writer.on("finish", resolve);
      writer.on("error", reject);
      stream.on("error", reject);
    });
  }

  async uploadFile(handle: WatchExportUploadHandle, filePath: string): Promise<WatchExportObjectMetadata> {
    if (!handle.localPath) throw new Error("Local upload handle missing localPath");
    if (filePath !== handle.localPath) {
      await fs.copyFile(filePath, handle.localPath);
    }
    return this.completeUpload(handle);
  }

  async completeUpload(handle: WatchExportUploadHandle): Promise<WatchExportObjectMetadata> {
    if (!handle.localPath) throw new Error("Local upload handle missing localPath");
    const stat = await fs.stat(handle.localPath);
    const checksum = await this.sha256File(handle.localPath);
    return {
      objectKey: handle.objectKey,
      contentType: "text/csv",
      fileSizeBytes: stat.size,
      checksum,
    };
  }

  async abortUpload(handle: WatchExportUploadHandle): Promise<void> {
    if (handle.localPath) {
      await fs.unlink(handle.localPath).catch(() => undefined);
    }
  }

  async createSignedDownloadUrl(_objectKey: string): Promise<string> {
    throw new Error("LocalWatchExportStorage does not create signed URLs; use HMAC download tokens in development");
  }

  async deleteObject(objectKey: string): Promise<void> {
    const filePath = path.join(this.rootDir, path.basename(objectKey));
    await fs.unlink(filePath).catch(() => undefined);
  }

  async objectExists(objectKey: string): Promise<boolean> {
    const filePath = path.join(this.rootDir, path.basename(objectKey));
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(objectKey: string): Promise<WatchExportObjectMetadata | null> {
    const filePath = path.join(this.rootDir, path.basename(objectKey));
    try {
      const stat = await fs.stat(filePath);
      const checksum = await this.sha256File(filePath);
      return {
        objectKey,
        contentType: "text/csv",
        fileSizeBytes: stat.size,
        checksum,
      };
    } catch {
      return null;
    }
  }

  resolveLocalPath(objectKey: string) {
    return path.join(this.rootDir, path.basename(objectKey));
  }

  private sha256File(filePath: string) {
    return new Promise<string>((resolve, reject) => {
      const hash = createHash("sha256");
      createReadStream(filePath)
        .on("data", (chunk: Buffer) => hash.update(chunk))
        .on("error", reject)
        .on("end", () => resolve(hash.digest("hex")));
    });
  }
}
