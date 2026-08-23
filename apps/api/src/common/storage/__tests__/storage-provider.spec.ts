import { generateKeyPairSync } from "crypto";
import { BadRequestException } from "@nestjs/common";
import {
  assertEvidenceObjectKey,
  assertFirebaseStorageConfiguration,
  createStorageDownloadUrl,
  createStorageUploadUrl,
  evidenceObjectKey,
  getConfiguredStorageBucket,
  resolveStorageProviderName,
} from "../s3-presign";

const savedEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...savedEnv };
}

function configureFirebaseStaging() {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.STORAGE_PROVIDER = "firebase";
  process.env.THE_EYE_APP_ENV = "staging";
  process.env.FIREBASE_PROJECT_ID = "the-eye-2stg";
  process.env.FCM_PROJECT_ID = "the-eye-2stg";
  process.env.FIREBASE_STORAGE_BUCKET = "the-eye-2stg.firebasestorage.app";
  process.env.FCM_CLIENT_EMAIL = "firebase-storage-signer@example.iam.gserviceaccount.com";
  process.env.FCM_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

describe("storage provider selection", () => {
  it("resolves staging evidence storage to Firebase when selected", () => {
    restoreEnv();
    configureFirebaseStaging();

    expect(resolveStorageProviderName()).toBe("firebase");
    expect(getConfiguredStorageBucket()).toBe("the-eye-2stg.firebasestorage.app");
    expect(() => assertFirebaseStorageConfiguration()).not.toThrow();
    restoreEnv();
  });

  it("rejects production Firebase Storage bucket in staging", () => {
    restoreEnv();
    configureFirebaseStaging();
    process.env.FIREBASE_STORAGE_BUCKET = "the-eye-2pd-d0217.firebasestorage.app";

    try {
      assertFirebaseStorageConfiguration();
      throw new Error("Expected staging Firebase bucket guard to reject production bucket");
    } catch (error) {
      expect(String((error as Error).message)).toContain("production Firebase Storage bucket");
    }
    restoreEnv();
  });

  it("creates a time-limited Firebase upload URL without exposing MinIO", async () => {
    restoreEnv();
    configureFirebaseStaging();

    const signed = await createStorageUploadUrl("evidence/incident-1/file.jpg", 300, "image/jpeg");
    const url = new URL(signed.url);

    expect(signed.bucket).toBe("the-eye-2stg.firebasestorage.app");
    expect(url.hostname).toBe("storage.googleapis.com");
    expect(url.pathname).toContain("/the-eye-2stg.firebasestorage.app/evidence/incident-1/file.jpg");
    expect(url.searchParams.get("X-Goog-Expires")).toBe("300");
    expect(signed.url).not.toContain("minio");
    restoreEnv();
  });

  it("creates a short-lived Firebase download URL", async () => {
    restoreEnv();
    configureFirebaseStaging();

    const signed = await createStorageDownloadUrl("evidence/incident-1/file.jpg", 120);

    expect(new URL(signed.url).searchParams.get("X-Goog-Expires")).toBe("120");
    restoreEnv();
  });

  it("keeps object paths scoped and rejects traversal", async () => {
    restoreEnv();
    configureFirebaseStaging();

    const objectKey = evidenceObjectKey("incident-1", "../../photo.jpg");
    expect(objectKey).toMatch(/^evidence\/incident-1\/[0-9a-f-]+\.jpg$/);
    expect(() => assertEvidenceObjectKey("incident-1", objectKey, "the-eye-2stg.firebasestorage.app", "image/jpeg")).not.toThrow();
    await expect(createStorageUploadUrl("../incident-1/file.jpg", 300, "image/jpeg")).rejects.toThrow(BadRequestException);
    restoreEnv();
  });

  it("accepts server-generated dynamic-area voice evidence keys", () => {
    restoreEnv();
    configureFirebaseStaging();

    const ownerId = "nw-da-da_NIGERIA_RIVERS_OBIO_AKPOR";
    const objectKey = evidenceObjectKey(ownerId, "voice-report.m4a");

    expect(() =>
      assertEvidenceObjectKey(
        ownerId,
        objectKey,
        "the-eye-2stg.firebasestorage.app",
        "audio/mp4",
      ),
    ).not.toThrow();
    restoreEnv();
  });

  it("leaves MinIO/S3 available as explicit legacy mode", async () => {
    restoreEnv();
    process.env.STORAGE_PROVIDER = "s3";
    process.env.S3_ENDPOINT = "http://minio:9000";
    process.env.S3_PUBLIC_ENDPOINT = "https://storage.staging.example.com";
    process.env.S3_BUCKET = "the-eye";
    process.env.S3_ACCESS_KEY = "test-access";
    process.env.S3_SECRET_KEY = "test-secret";

    const signed = await createStorageUploadUrl("evidence/incident-1/file.jpg", 300, "image/jpeg");

    expect(signed.bucket).toBe("the-eye");
    expect(new URL(signed.url).origin).toBe("https://storage.staging.example.com");
    restoreEnv();
  });
});
