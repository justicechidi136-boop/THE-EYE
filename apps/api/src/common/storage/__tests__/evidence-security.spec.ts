import { BadRequestException } from "@nestjs/common";
import { assertEvidenceObjectKey, createS3PresignedPutUrl, evidenceObjectKey } from "../s3-presign";

describe("evidence storage security", () => {
  it("rejects evidence object keys outside the incident prefix", () => {
    process.env.S3_BUCKET = "the-eye";
    expect(() => assertEvidenceObjectKey("incident-1", "evidence/other-incident/file.jpg", "the-eye", "image/jpeg")).toThrow(BadRequestException);
    expect(() => assertEvidenceObjectKey("incident-1", "evidence/incident-1/../../etc/passwd", "the-eye", "image/jpeg")).toThrow(BadRequestException);
    expect(() => assertEvidenceObjectKey("incident-1", "evidence/incident-1/valid-uuid.jpg", "wrong-bucket", "image/jpeg")).toThrow(BadRequestException);
  });

  it("accepts scoped evidence keys for the owning incident", () => {
    process.env.S3_BUCKET = "the-eye";
    const key = evidenceObjectKey("incident-1", "photo.jpg");
    expect(() => assertEvidenceObjectKey("incident-1", key, "the-eye", "image/jpeg")).not.toThrow();
  });

  it("binds content-type into the presigned upload signature", () => {
    process.env.S3_ENDPOINT = "https://storage.example.com";
    process.env.S3_BUCKET = "the-eye";
    process.env.S3_ACCESS_KEY = "test-access";
    process.env.S3_SECRET_KEY = "test-secret";
    const url = createS3PresignedPutUrl("evidence/incident-1/file.jpg", 300, "image/jpeg");
    expect(url).toContain("X-Amz-SignedHeaders=content-type%3Bhost");
  });
});
