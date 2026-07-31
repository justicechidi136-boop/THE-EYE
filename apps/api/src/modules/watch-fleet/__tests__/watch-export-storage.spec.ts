import {
  assertWatchExportStorageConfiguration,
  createWatchExportStorage,
  resolveWatchExportStorageProvider,
} from "../storage/watch-export-storage.config";
import { buildWatchExportObjectKey, createWatchExportPresignedGetUrl } from "../storage/watch-export-s3-client";
import { LocalWatchExportStorage } from "../storage/local-watch-export-storage";
import { WatchExportService } from "../watch-export.service";

function expectThrows(fn: () => void, messagePart: string) {
  try {
    fn();
    throw new Error(`Expected throw containing "${messagePart}"`);
  } catch (error) {
    if (error instanceof Error && error.message === `Expected throw containing "${messagePart}"`) throw error;
    expect(String(error)).toContain(messagePart);
  }
}

describe("watch export storage configuration", () => {
  it("defaults to local provider in development", () => {
    expect(resolveWatchExportStorageProvider({ THE_EYE_APP_ENV: "development" })).toBe("local");
  });

  it("rejects local storage in production without emergency override", () => {
    expectThrows(
      () =>
        assertWatchExportStorageConfiguration({
          THE_EYE_APP_ENV: "production",
          WATCH_EXPORT_STORAGE_PROVIDER: "local",
        }),
      "not allowed in production",
    );
  });

  it("allows local storage emergency override in production", () => {
    expect(() =>
      assertWatchExportStorageConfiguration({
        THE_EYE_APP_ENV: "production",
        WATCH_EXPORT_STORAGE_PROVIDER: "local",
        WATCH_EXPORT_ALLOW_LOCAL_IN_PRODUCTION: "1",
      }),
    ).not.toThrow();
  });

  it("requires S3 credentials when provider is s3", () => {
    expectThrows(
      () =>
        assertWatchExportStorageConfiguration({
          THE_EYE_APP_ENV: "production",
          WATCH_EXPORT_STORAGE_PROVIDER: "s3",
        }),
      "requires WATCH_EXPORT_S3_",
    );
  });

  it("accepts S3 configuration with fallback env vars", () => {
    expect(() =>
      assertWatchExportStorageConfiguration({
        THE_EYE_APP_ENV: "production",
        WATCH_EXPORT_STORAGE_PROVIDER: "s3",
        S3_ENDPOINT: "https://storage.example.com",
        S3_BUCKET: "the-eye-exports",
        S3_ACCESS_KEY: "access-key",
        S3_SECRET_KEY: "secret-key-value-long-enough",
      }),
    ).not.toThrow();
  });

  it("creates local storage provider in development", () => {
    process.env.THE_EYE_APP_ENV = "development";
    process.env.WATCH_EXPORT_STORAGE_PROVIDER = "local";
    const storage = createWatchExportStorage();
    expect(storage.provider).toBe("local");
    expect(storage).toBeInstanceOf(LocalWatchExportStorage);
  });
});

describe("watch export object key safety", () => {
  it("builds PII-free object keys with environment and job id", () => {
    const key = buildWatchExportObjectKey("staging", "job-123", new Date("2026-07-31T12:00:00Z"));
    expect(key).toBe("watch-fleet-exports/staging/2026/07/job-123.csv");
    expect(key).not.toMatch(/@|phone|email/i);
  });

  it("creates presigned GET URLs without exposing credentials", () => {
    const url = createWatchExportPresignedGetUrl(
      {
        endpoint: "https://nyc3.digitaloceanspaces.com",
        bucket: "the-eye-exports",
        accessKeyId: "DO00TESTKEY",
        secretAccessKey: "super-secret-key-not-in-url",
        region: "us-east-1",
        forcePathStyle: false,
      },
      "watch-fleet-exports/staging/2026/07/job-123.csv",
      900,
    );
    expect(url).toContain("X-Amz-Signature=");
    expect(url).not.toContain("super-secret-key-not-in-url");
  });
});

describe("watch export download authorization", () => {
  function makeService() {
    return new WatchExportService(
      { smartwatchDevice: { findMany: jest.fn() }, watchExportJob: {} },
      { record: jest.fn() },
      {
        recordSignedUrl: jest.fn(),
        logExportEvent: jest.fn(),
        recordRequested: jest.fn(),
        recordQueued: jest.fn(),
        recordRunning: jest.fn(),
        recordCompleted: jest.fn(),
        recordFailed: jest.fn(),
        recordCleanup: jest.fn(),
      },
    );
  }

  it("rejects expired exports", () => {
    const service = makeService();
    expectThrows(
      () =>
        service.assertExportDownloadAuthorized(
          { typ: "admin", sub: "admin-1", role: "Super Admin" },
          {
            requestedByAdminId: "admin-1",
            geographyScope: {},
            status: "READY",
            storageKey: "key.csv",
            expiresAt: new Date(Date.now() - 60_000).toISOString(),
          },
        ),
      "expired",
    );
  });

  it("rejects failed exports", () => {
    const service = makeService();
    expectThrows(
      () =>
        service.assertExportDownloadAuthorized(
          { typ: "admin", sub: "admin-1", role: "Super Admin" },
          {
            requestedByAdminId: "admin-1",
            geographyScope: {},
            status: "FAILED",
            storageKey: "key.csv",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        ),
      "failed",
    );
  });

  it("rejects geography scope outside admin jurisdiction", () => {
    const service = makeService();
    expectThrows(
      () =>
        service.assertExportDownloadAuthorized(
          {
            typ: "admin",
            sub: "admin-1",
            role: "LGA Admin",
            country: "NG",
            state: "Lagos",
            lga: "Ikeja",
          },
          {
            requestedByAdminId: "admin-1",
            geographyScope: { country: "NG", state: "Lagos", lga: "Eti-Osa" },
            status: "READY",
            storageKey: "key.csv",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        ),
      "jurisdiction",
    );
  });
});

describe("watch export HMAC download tokens", () => {
  it("round-trips valid local download tokens", () => {
    process.env.JWT_ACCESS_SECRET = "test-export-secret-value-32chars";
    const service = new WatchExportService({}, { record: jest.fn() }, {
      recordSignedUrl: jest.fn(),
      logExportEvent: jest.fn(),
      recordRequested: jest.fn(),
      recordQueued: jest.fn(),
      recordRunning: jest.fn(),
      recordCompleted: jest.fn(),
      recordFailed: jest.fn(),
      recordCleanup: jest.fn(),
    });
    const expiresAt = new Date(Date.now() + 60_000);
    const token = service.createDownloadToken("job-1", "watch-fleet-exports/dev/job-1.csv", expiresAt);
    const verified = service.verifyDownloadToken(token);
    expect(verified.exportJobId).toBe("job-1");
    expect(verified.storageKey).toBe("watch-fleet-exports/dev/job-1.csv");
  });
});
