import { createHash, createHmac, randomUUID } from "crypto";
import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { Storage } from "@google-cloud/storage";
import { resolveFcmCredentials } from "../auth/firebase-credentials";
import { resolveAppEnvironment } from "../auth/firebase-environment";
import { PRODUCTION_FIREBASE_PROJECT_ID, STAGING_FIREBASE_PROJECT_ID } from "../auth/firebase-project";

const allowedContentTypes = new Set([
  "image/jpeg", "image/png", "image/webp",
  "video/mp4", "video/webm",
  "audio/mpeg", "audio/mp4", "audio/webm", "audio/aac", "audio/x-m4a",
  "application/pdf",
]);

const avatarContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const vehiclePhotoContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const evidenceKeyPattern = /^evidence\/[a-zA-Z0-9-]+\/[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/i;
const avatarKeyPattern = /^avatars\/[a-zA-Z0-9-]+\/[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/i;
const kycKeyPattern = /^kyc\/[a-zA-Z0-9-]+\/[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/i;
const droneOperatorDocKeyPattern = /^drone-operators\/[0-9a-f-]{36}\/[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/i;
const supportKeyPattern = /^support\/[a-zA-Z0-9-]+\/[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/i;
const vehiclePhotoKeyPattern =
  /^vehicles\/[a-zA-Z0-9-]+\/[0-9a-f-]{36}\/[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/i;

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const VEHICLE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const STAGING_FIREBASE_STORAGE_BUCKET = "the-eye-2stg.firebasestorage.app";
const PRODUCTION_FIREBASE_STORAGE_BUCKET = "the-eye-2pd-d0217.firebasestorage.app";

export type StorageProviderName = "s3" | "firebase";

export type StorageSignedUrl = {
  bucket: string;
  url: string;
  expiresInSeconds: number;
};

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

export function resolveStorageProviderName(env: Record<string, unknown> = process.env): StorageProviderName {
  const value = String(env.STORAGE_PROVIDER ?? "s3").trim().toLowerCase();
  if (value === "s3" || value === "minio") return "s3";
  if (value === "firebase") return "firebase";
  throw new InternalServerErrorException("Unsupported evidence storage provider");
}

export function getConfiguredStorageBucket(env: Record<string, unknown> = process.env) {
  const provider = resolveStorageProviderName(env);
  if (provider === "firebase") {
    const bucket = String(env.FIREBASE_STORAGE_BUCKET ?? "").trim();
    if (!bucket) throw new InternalServerErrorException("Firebase evidence storage bucket is not configured");
    return bucket;
  }
  return String(env.S3_BUCKET ?? "the-eye").trim();
}

export function assertFirebaseStorageConfiguration(env: Record<string, unknown> = process.env) {
  if (resolveStorageProviderName(env) !== "firebase") return;

  const appEnvironment = resolveAppEnvironment(env);
  const projectId = String(env.FIREBASE_PROJECT_ID ?? "").trim();
  const bucket = String(env.FIREBASE_STORAGE_BUCKET ?? "").trim();
  if (!bucket) throw new Error("FIREBASE_STORAGE_BUCKET is required when STORAGE_PROVIDER=firebase");
  if (bucket === PRODUCTION_FIREBASE_STORAGE_BUCKET && appEnvironment === "staging") {
    throw new Error("FIREBASE_STORAGE_BUCKET must not use the production Firebase Storage bucket in staging");
  }
  if (projectId === PRODUCTION_FIREBASE_PROJECT_ID && appEnvironment === "staging") {
    throw new Error("FIREBASE_PROJECT_ID must not use the production Firebase project in staging");
  }
  if (appEnvironment === "staging") {
    if (projectId !== STAGING_FIREBASE_PROJECT_ID) {
      throw new Error(`FIREBASE_PROJECT_ID must be ${STAGING_FIREBASE_PROJECT_ID} in staging`);
    }
    if (bucket !== STAGING_FIREBASE_STORAGE_BUCKET) {
      throw new Error(`FIREBASE_STORAGE_BUCKET must be ${STAGING_FIREBASE_STORAGE_BUCKET} in staging`);
    }
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

export function validateVehiclePhotoUpload(contentType: string, sizeBytes?: number) {
  if (!vehiclePhotoContentTypes.has(contentType)) {
    throw new BadRequestException("Vehicle photo must be JPEG, PNG, or WebP");
  }
  if (
    sizeBytes !== undefined &&
    (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > VEHICLE_PHOTO_MAX_BYTES)
  ) {
    throw new BadRequestException("Vehicle photo file size must be between 1 byte and 5 MB");
  }
}

export function vehiclePhotoObjectKey(userId: string, vehicleId: string, fileName: string) {
  const extension = fileName.toLowerCase().match(/\.[a-z0-9]{1,8}$/)?.[0] ?? ".jpg";
  return `vehicles/${userId}/${vehicleId}/${randomUUID()}${extension}`;
}

export function assertVehiclePhotoObjectKey(
  userId: string,
  vehicleId: string,
  objectKey: string,
  contentType?: string,
) {
  if (
    !userId ||
    !vehicleId ||
    objectKey.includes("..") ||
    !objectKey.startsWith(`vehicles/${userId}/${vehicleId}/`)
  ) {
    throw new BadRequestException("Vehicle photo objectKey must remain under the vehicle photo prefix");
  }
  if (!vehiclePhotoKeyPattern.test(objectKey)) {
    throw new BadRequestException("Invalid vehicle photo object key format");
  }
  if (contentType) validateVehiclePhotoUpload(contentType);
}

export function assertAvatarObjectKey(userId: string, objectKey: string, bucket: string, contentType?: string) {
  const expectedBucket = getConfiguredStorageBucket();
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

export function supportAttachmentObjectKey(conversationId: string, fileName: string) {
  const extension = fileName.toLowerCase().match(/\.[a-z0-9]{1,8}$/)?.[0] ?? "";
  return `support/${conversationId}/${randomUUID()}${extension}`;
}

export function assertSupportAttachmentObjectKey(conversationId: string, objectKey: string, bucket: string, contentType?: string) {
  const expectedBucket = getConfiguredStorageBucket();
  if (bucket !== expectedBucket) throw new BadRequestException("Support attachment bucket mismatch");
  if (!conversationId || objectKey.includes("..") || !objectKey.startsWith(`support/${conversationId}/`)) {
    throw new BadRequestException("Support attachment objectKey must remain under the conversation prefix");
  }
  if (!supportKeyPattern.test(objectKey)) throw new BadRequestException("Invalid support attachment object key format");
  if (contentType) validateEvidenceUpload(contentType);
}

export function droneOperatorDocumentObjectKey(operatorId: string, fileName: string) {
  const extension = fileName.toLowerCase().match(/\.[a-z0-9]{1,8}$/)?.[0] ?? "";
  return `drone-operators/${operatorId}/${randomUUID()}${extension}`;
}

export function assertDroneOperatorDocumentObjectKey(operatorId: string, objectKey: string, bucket: string, contentType?: string) {
  const expectedBucket = getConfiguredStorageBucket();
  if (bucket !== expectedBucket) throw new BadRequestException("Document bucket mismatch");
  if (!operatorId || objectKey.includes("..") || !objectKey.startsWith(`drone-operators/${operatorId}/`)) {
    throw new BadRequestException("Document objectKey must remain under the operator document prefix");
  }
  if (!droneOperatorDocKeyPattern.test(objectKey)) throw new BadRequestException("Invalid operator document object key format");
  if (contentType) validateEvidenceUpload(contentType);
}

export function assertEvidenceObjectKey(incidentId: string, objectKey: string, bucket: string, contentType?: string) {
  const expectedBucket = getConfiguredStorageBucket();
  if (bucket !== expectedBucket) throw new BadRequestException("Evidence bucket mismatch");
  if (!incidentId || objectKey.includes("..") || !objectKey.startsWith(`evidence/${incidentId}/`)) {
    throw new BadRequestException("Evidence objectKey must remain under the incident upload prefix");
  }
  if (!evidenceKeyPattern.test(objectKey)) throw new BadRequestException("Invalid evidence object key format");
  if (contentType) validateEvidenceUpload(contentType);
}

export function createS3PresignedPutUrl(objectKey: string, expiresSeconds = 900, contentType?: string) {
  const endpoint = process.env.S3_ENDPOINT;
  const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT?.trim() || endpoint;
  const bucket = process.env.S3_BUCKET;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  const region = process.env.S3_REGION ?? "us-east-1";
  if (!endpoint || !publicEndpoint || !bucket || !accessKey || !secretKey) {
    throw new InternalServerErrorException("Evidence storage is not configured");
  }
  if (contentType) {
    if (objectKey.startsWith("avatars/")) {
      validateAvatarUpload(contentType);
    } else if (objectKey.startsWith("vehicles/")) {
      validateVehiclePhotoUpload(contentType);
    } else {
      validateEvidenceUpload(contentType);
    }
  }

  const now = new Date();
  const date = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = date.slice(0, 8);
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const credential = `${accessKey}/${scope}`;
  const url = new URL(publicEndpoint);
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

export function createS3PresignedGetUrl(objectKey: string, expiresSeconds = 300) {
  const endpoint = process.env.S3_ENDPOINT;
  const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT?.trim() || endpoint;
  const bucket = process.env.S3_BUCKET;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  const region = process.env.S3_REGION ?? "us-east-1";
  if (!endpoint || !publicEndpoint || !bucket || !accessKey || !secretKey) {
    throw new InternalServerErrorException("Evidence storage is not configured");
  }

  const now = new Date();
  const date = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = date.slice(0, 8);
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const credential = `${accessKey}/${scope}`;
  const url = new URL(publicEndpoint);
  const canonicalUri = `/${encodePath(`${bucket}/${objectKey}`)}`;
  const signedHeaders = "host";
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": date,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": signedHeaders,
  });
  query.sort();

  const canonicalHeaders = `host:${url.host}\n`;
  const canonicalRequest = ["GET", canonicalUri, query.toString(), canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", date, scope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return `${url.origin}${canonicalUri}?${query.toString()}&X-Amz-Signature=${signature}`;
}

function validateStorageObjectKey(objectKey: string) {
  if (!objectKey || objectKey.includes("..") || objectKey.startsWith("/") || objectKey.includes("\\")) {
    throw new BadRequestException("Invalid storage object key");
  }
  if (
    !objectKey.startsWith("evidence/") &&
    !objectKey.startsWith("avatars/") &&
    !objectKey.startsWith("vehicles/") &&
    !objectKey.startsWith("kyc/") &&
    !objectKey.startsWith("support/") &&
    !objectKey.startsWith("drone-operators/")
  ) {
    throw new BadRequestException("Storage object key must remain under an approved prefix");
  }
}

async function createFirebaseSignedUrl(
  action: "read" | "write",
  objectKey: string,
  expiresSeconds: number,
  contentType?: string,
): Promise<StorageSignedUrl> {
  validateStorageObjectKey(objectKey);
  assertFirebaseStorageConfiguration();
  const bucket = getConfiguredStorageBucket();
  const credentials = resolveFcmCredentials(process.env);
  if (!credentials?.clientEmail || !credentials.privateKey) {
    throw new InternalServerErrorException("Firebase evidence storage credentials are not configured");
  }

  const storage = new Storage({
    projectId: credentials.projectId || String(process.env.FIREBASE_PROJECT_ID ?? "").trim(),
    credentials: {
      client_email: credentials.clientEmail,
      private_key: credentials.privateKey,
    },
  });
  const [url] = await storage.bucket(bucket).file(objectKey).getSignedUrl({
    version: "v4",
    action,
    expires: Date.now() + expiresSeconds * 1000,
    ...(action === "write" && contentType ? { contentType } : {}),
  });

  return { bucket, url, expiresInSeconds: expiresSeconds };
}

export async function createStorageUploadUrl(
  objectKey: string,
  expiresSeconds = 900,
  contentType?: string,
): Promise<StorageSignedUrl> {
  if (resolveStorageProviderName() === "firebase") {
    if (contentType) {
      if (objectKey.startsWith("avatars/")) {
        validateAvatarUpload(contentType);
      } else if (objectKey.startsWith("vehicles/")) {
        validateVehiclePhotoUpload(contentType);
      } else {
        validateEvidenceUpload(contentType);
      }
    }
    return createFirebaseSignedUrl("write", objectKey, expiresSeconds, contentType);
  }
  return {
    bucket: getConfiguredStorageBucket(),
    url: createS3PresignedPutUrl(objectKey, expiresSeconds, contentType),
    expiresInSeconds: expiresSeconds,
  };
}

export async function createStorageDownloadUrl(objectKey: string, expiresSeconds = 300): Promise<StorageSignedUrl> {
  if (resolveStorageProviderName() === "firebase") {
    return createFirebaseSignedUrl("read", objectKey, expiresSeconds);
  }
  return {
    bucket: getConfiguredStorageBucket(),
    url: createS3PresignedGetUrl(objectKey, expiresSeconds),
    expiresInSeconds: expiresSeconds,
  };
}
