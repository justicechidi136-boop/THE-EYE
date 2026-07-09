import { createHash, createHmac, randomUUID } from "crypto";
import { BadRequestException, InternalServerErrorException } from "@nestjs/common";

const allowedContentTypes = new Set([
  "image/jpeg", "image/png", "image/webp",
  "video/mp4", "video/webm",
  "audio/mpeg", "audio/mp4", "audio/webm",
  "application/pdf",
]);

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

export function createS3PresignedPutUrl(objectKey: string, expiresSeconds = 900) {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  const region = process.env.S3_REGION ?? "us-east-1";
  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw new InternalServerErrorException("Evidence storage is not configured");
  }

  const now = new Date();
  const date = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = date.slice(0, 8);
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const credential = `${accessKey}/${scope}`;
  const url = new URL(endpoint);
  const canonicalUri = `/${encodePath(`${bucket}/${objectKey}`)}`;
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": date,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": "host",
  });
  query.sort();

  const canonicalRequest = ["PUT", canonicalUri, query.toString(), `host:${url.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", date, scope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return `${url.origin}${canonicalUri}?${query.toString()}&X-Amz-Signature=${signature}`;
}
