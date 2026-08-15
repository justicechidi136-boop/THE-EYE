import { BadRequestException } from "@nestjs/common";
import { createS3PresignedGetUrl, createS3PresignedPutUrl, evidenceObjectKey, validateEvidenceUpload } from "../s3-presign";

describe("evidence upload signing", () => {
  it("creates a scoped private object key without retaining unsafe file names", () => {
    const key = evidenceObjectKey("incident-1", "../../evidence.JPG");
    expect(key).toMatch(/^evidence\/incident-1\/[0-9a-f-]+\.jpg$/);
  });

  it("rejects executable content types and oversized evidence", () => {
    expect(() => validateEvidenceUpload("text/html", 100)).toThrow(BadRequestException);
    expect(() => validateEvidenceUpload("video/mp4", 101 * 1024 * 1024)).toThrow(BadRequestException);
  });

  it("creates a time-limited AWS Signature V4 upload URL", () => {
    process.env.S3_ENDPOINT = "https://storage.example.com";
    delete process.env.S3_PUBLIC_ENDPOINT;
    process.env.S3_BUCKET = "the-eye";
    process.env.S3_ACCESS_KEY = "test-access";
    process.env.S3_SECRET_KEY = "test-secret";
    const url = createS3PresignedPutUrl("evidence/incident-1/file.jpg");
    expect(url).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256");
    expect(url).toContain("X-Amz-Signature=");
    expect(url).toContain("X-Amz-Expires=900");
  });

  it("uses a client-reachable public endpoint when signing URLs", () => {
    process.env.S3_ENDPOINT = "http://minio:9000";
    process.env.S3_PUBLIC_ENDPOINT = "https://storage.staging.example.com";
    process.env.S3_BUCKET = "the-eye";
    process.env.S3_ACCESS_KEY = "test-access";
    process.env.S3_SECRET_KEY = "test-secret";

    const putUrl = createS3PresignedPutUrl("evidence/incident-1/file.jpg", 300, "image/jpeg");
    const getUrl = createS3PresignedGetUrl("evidence/incident-1/file.jpg", 300);

    expect(new URL(putUrl).origin).toBe("https://storage.staging.example.com");
    expect(new URL(getUrl).origin).toBe("https://storage.staging.example.com");
    expect(putUrl).not.toContain("minio:9000");
    expect(getUrl).not.toContain("minio:9000");
    delete process.env.S3_PUBLIC_ENDPOINT;
  });

  it("falls back to the internal endpoint when the public endpoint is blank", () => {
    process.env.S3_ENDPOINT = "http://minio:9000";
    process.env.S3_PUBLIC_ENDPOINT = "";
    process.env.S3_BUCKET = "the-eye";
    process.env.S3_ACCESS_KEY = "test-access";
    process.env.S3_SECRET_KEY = "test-secret";

    const url = createS3PresignedPutUrl("evidence/incident-1/file.jpg");

    expect(new URL(url).origin).toBe("http://minio:9000");
    delete process.env.S3_PUBLIC_ENDPOINT;
  });
});
