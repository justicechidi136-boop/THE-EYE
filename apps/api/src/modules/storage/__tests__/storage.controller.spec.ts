import { generateKeyPairSync } from "crypto";
import { StorageController } from "../storage.controller";

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

function firebaseObjectPath(url: URL) {
  return decodeURIComponent(url.pathname).replace(/^\/+/, "");
}

describe("StorageController Firebase presign contract", () => {
  it("returns upload and GET signed URLs for the same generated evidence object", async () => {
    restoreEnv();
    configureFirebaseStaging();
    const controller = new StorageController();

    const result = await controller.presignUpload(
      { fileName: "proof.png", contentType: "image/png", sizeBytes: 64 },
      { user: { sub: "citizen-1" } },
    );

    const upload = new URL(result.uploadUrl);
    const get = new URL(result.getUrl);

    expect(result.bucket).toBe("the-eye-2stg.firebasestorage.app");
    expect(result.objectKey).toMatch(/^evidence\/citizen-1\/[0-9a-f-]+\.png$/);
    expect(result.expiresInSeconds).toBe(900);
    expect(result.getExpiresInSeconds).toBe(300);

    expect(upload.protocol).toBe("https:");
    expect(upload.hostname).toBe("storage.googleapis.com");
    expect(upload.searchParams.get("X-Goog-Expires")).toBe("900");
    expect(upload.searchParams.get("X-Goog-Signature")).toBeDefined();

    expect(get.protocol).toBe("https:");
    expect(get.hostname).toBe("storage.googleapis.com");
    expect(get.searchParams.get("X-Goog-Expires")).toBe("300");
    expect(get.searchParams.get("X-Goog-Signature")).toBeDefined();

    expect(firebaseObjectPath(upload)).toBe(`the-eye-2stg.firebasestorage.app/${result.objectKey}`);
    expect(firebaseObjectPath(get)).toBe(`the-eye-2stg.firebasestorage.app/${result.objectKey}`);
    expect(result.uploadUrl).not.toContain("minio");
    expect(result.getUrl).not.toContain("minio");
    restoreEnv();
  });

  it("still rejects production Firebase bucket in staging", async () => {
    restoreEnv();
    configureFirebaseStaging();
    process.env.FIREBASE_STORAGE_BUCKET = "the-eye-2pd-d0217.firebasestorage.app";
    const controller = new StorageController();

    await expect(controller.presignUpload(
      { fileName: "proof.png", contentType: "image/png", sizeBytes: 64 },
      { user: { sub: "citizen-1" } },
    )).rejects.toThrow("production Firebase Storage bucket");
    restoreEnv();
  });

  it("continues to reject unsafe evidence uploads before signing", async () => {
    restoreEnv();
    configureFirebaseStaging();
    const controller = new StorageController();

    await expect(controller.presignUpload(
      { fileName: "../malware.exe", contentType: "application/x-msdownload", sizeBytes: 64 },
      { user: { sub: "citizen-1" } },
    )).rejects.toThrow();
    restoreEnv();
  });
});
