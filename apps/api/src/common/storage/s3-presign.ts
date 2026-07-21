import { createHash, createHmac, randomUUID } from "crypto";
import { BadRequestException, InternalServerErrorException } from "@nestjs/common";

const allowedContentTypes = new Set([
  "image/jpeg", "image/png", "image/webp",
  "video/mp4", "video/webm",
  "audio/mpeg", "audio/mp4", "audio/webm",
  "application/pdf",
]);

const avatarContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const evidenceKeyPattern = /^evidence\/[a-zA-Z0-9-]+\/[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/i;
const avatarKeyPattern = /^avatars\/[a-zA-Z0-9-]+\/[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/i;
const kycKeyPattern = /^kyc\/[a-zA-Z0-9-]+\/[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/i;

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function validateEvidenceUpload(contentType: string, sizeBytes?: number) {
  if (!allowedContentTypes.has(contentType)) throw new BadRequestException("Unsupported evidence content type");
  if (sizeBytes !== undefined && (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > 100 * 1024 * 1024)) {
    throw new BadRequestException("Evidence file size must be between 1 byte and 100 MB");
  }
}

export function evidenceObjectKey(ownerId: string, fileName: string) {
  const extension = fileName.toLowerCase().match(/\.[a-z0-9]{1,8}$/)?.[0] ?? "";
  return `evidence/${ownerId}/${randomUUID()}${extension}`;
}

export function validateAvatarUpload(contentType: string, sizeBytes?: number) {
  if (!avatarContentTypes.has(contentType)) {
    throw new BadRequestException("Avatar must be JPEG, PNG, or WebP");
  }
  if (sizeBytes !== undefined && (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > AVATAR_MAX_BYTES)) {
    throw new BadRequestException("Avatar file size must be between 1 byte and 5 MB");
  }
}

export function avatarObjectKey(userId: string, fileName: string) {
  const extension = fileName.toLowerCase().match(/\.[a-z0-9]{1,8}$/)?.[0] ?? ".jpg";
  return `avatars/${userId}/${randomUUID()}${extension}`;
}

export function assertAvatarObjectKey(userId: string, objectKey: string, bucket: string, contentType?: string) {
  const expectedBucket = process.env.S3_BUCKET ?? "the-eye";
  if (bucket !== expectedBucket) throw new BadRequestException("Avatar bucket mismatch");
  if (!userId || objectKey.includes("..") || !objectKey.startsWith(`avatars/${userId}/`)) {
    throw new BadRequestException("Avatar objectKey must remain under the user avatar prefix");
  }
  if (!avatarKeyPattern.test(objectKey)) throw new BadRequestException("Invalid avatar object key format");
  if (contentType) validateAvatarUpload(contentType);
}

export function kycObjectKey(userId: string, fileName: string) {
  const extension = fileName.toLowerCase().match(/\.[a-z0-9]{1,8}$/)?.[0] ?? "";
  return `kyc/${userId}/${randomUUID()}${extension}`;
}

export function assertKycObjectKey(userId: string, objectKey: string) {
  if (!userId || objectKey.includes("..") || !objectKey.startsWith(`kyc/${userId}/`)) {
    throw new BadRequestException("KYC objectKey must remain under the user KYC prefix");
  }
  if (!kycKeyPattern.test(objectKey)) throw new BadRequestException("Invalid KYC object key format");
}

export function assertEvidenceObjectKey(incidentId: string, objectKey: string, bucket: string, contentType?: string) {
  const expectedBucket = process.env.S3_BUCKET ?? "the-eye";
  if (bucket !== expectedBucket) throw new BadRequestException("Evidence bucket mismatch");
  if (!incidentId || objectKey.includes("..") || !objectKey.startsWith(`evidence/${incidentId}/`)) {
    throw new BadRequestException("Evidence objectKey must remain under the incident upload prefix");
  }
  if (!evidenceKeyPattern.test(objectKey)) throw new BadRequestException("Invalid evidence object key format");
  if (contentType) validateEvidenceUpload(contentType);
}

export function createS3PresignedPutUrl(objectKey: string, expiresSeconds = 900, contentType?: string) {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  const region = process.env.S3_REGION ?? "us-east-1";
  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw new InternalServerErrorException("Evidence storage is not configured");
  }
  if (contentType) validateEvidenceUpload(contentType);

  const now = new Date();
  const date = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = date.slice(0, 8);
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const credential = `${accessKey}/${scope}`;
  const url = new URL(endpoint);
  const canonicalUri = `/${encodePath(`${bucket}/${objectKey}`)}`;
  const signedHeaders = contentType ? "content-type;host" : "host";
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": date,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": signedHeaders,
  });
  query.sort();

  const canonicalHeaders = contentType
    ? `content-type:${contentType}\nhost:${url.host}\n`
    : `host:${url.host}\n`;
  const canonicalRequest = ["PUT", canonicalUri, query.toString(), canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", date, scope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return `${url.origin}${canonicalUri}?${query.toString()}&X-Amz-Signature=${signature}`;
}
