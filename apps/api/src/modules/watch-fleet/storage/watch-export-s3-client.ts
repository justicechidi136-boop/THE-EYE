import { createHash, createHmac } from "crypto";
import { createReadStream, promises as fs } from "fs";
import { Readable } from "stream";
import { InternalServerErrorException } from "@nestjs/common";

const MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024;
const MULTIPART_PART_SIZE = 5 * 1024 * 1024;

export type WatchExportS3Config = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  forcePathStyle: boolean;
};

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function sha256Hex(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function resolveCanonicalUri(config: WatchExportS3Config, objectKey: string) {
  const encodedKey = encodePath(objectKey);
  if (config.forcePathStyle) {
    return `/${encodePath(config.bucket)}/${encodedKey}`;
  }
  return `/${encodedKey}`;
}

function resolveHost(config: WatchExportS3Config) {
  const url = new URL(config.endpoint);
  if (config.forcePathStyle) return url.host;
  return `${config.bucket}.${url.host}`;
}

function signRequest(
  config: WatchExportS3Config,
  method: string,
  objectKey: string,
  query: Record<string, string>,
  headers: Record<string, string>,
  payloadHash = "UNSIGNED-PAYLOAD",
) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const credential = `${config.accessKeyId}/${scope}`;

  const signedHeaderNames = Object.keys(headers).map((k) => k.toLowerCase()).sort();
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalHeaders = `${signedHeaderNames.map((name) => `${name}:${headers[name]}\n`).join("")}`;

  const canonicalUri = resolveCanonicalUri(config, objectKey);
  const queryParams = new URLSearchParams({ ...query, "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": credential, "X-Amz-Date": amzDate, "X-Amz-SignedHeaders": signedHeaders });
  if (method === "PUT" || method === "POST") {
    queryParams.set("X-Amz-Expires", query["X-Amz-Expires"] ?? "900");
  }
  queryParams.sort();

  const canonicalRequest = [method, canonicalUri, queryParams.toString(), canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), config.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  const url = new URL(config.endpoint);
  const host = resolveHost(config);
  const pathPrefix = config.forcePathStyle ? `/${encodePath(config.bucket)}` : "";
  const signedQuery = `${queryParams.toString()}&X-Amz-Signature=${signature}`;
  return {
    url: `${url.protocol}//${host}${pathPrefix}/${encodePath(objectKey)}?${signedQuery}`,
    host,
    amzDate,
    signature,
    signedHeaders,
    canonicalHeaders,
    canonicalUri,
    scope,
    credential,
  };
}

export function resolveWatchExportS3Config(config: Record<string, unknown> = process.env as Record<string, unknown>): WatchExportS3Config {
  const endpoint = String(config.WATCH_EXPORT_S3_ENDPOINT ?? config.S3_ENDPOINT ?? "").trim();
  const bucket = String(config.WATCH_EXPORT_S3_BUCKET ?? config.S3_BUCKET ?? "").trim();
  const accessKeyId = String(config.WATCH_EXPORT_S3_ACCESS_KEY_ID ?? config.S3_ACCESS_KEY ?? "").trim();
  const secretAccessKey = String(config.WATCH_EXPORT_S3_SECRET_ACCESS_KEY ?? config.S3_SECRET_KEY ?? "").trim();
  const region = String(config.WATCH_EXPORT_S3_REGION ?? config.S3_REGION ?? "us-east-1").trim();
  const forcePathStyle =
    config.WATCH_EXPORT_S3_FORCE_PATH_STYLE === "1" ||
    config.WATCH_EXPORT_S3_FORCE_PATH_STYLE === 1 ||
    config.WATCH_EXPORT_S3_FORCE_PATH_STYLE === "true" ||
    config.WATCH_EXPORT_S3_FORCE_PATH_STYLE === true;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new InternalServerErrorException("Watch export S3 storage is not configured");
  }

  return { endpoint, bucket, accessKeyId, secretAccessKey, region, forcePathStyle };
}

export function createWatchExportPresignedGetUrl(
  config: WatchExportS3Config,
  objectKey: string,
  expiresSeconds: number,
) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const credential = `${config.accessKeyId}/${scope}`;
  const url = new URL(config.endpoint);
  const host = resolveHost(config);
  const canonicalUri = resolveCanonicalUri(config, objectKey);
  const signedHeaders = "host";
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": signedHeaders,
  });
  query.sort();
  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = ["GET", canonicalUri, query.toString(), canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), config.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const pathPrefix = config.forcePathStyle ? `/${encodePath(config.bucket)}` : "";
  return `${url.protocol}//${host}${pathPrefix}/${encodePath(objectKey)}?${query.toString()}&X-Amz-Signature=${signature}`;
}

export async function putWatchExportObjectFromFile(
  config: WatchExportS3Config,
  objectKey: string,
  filePath: string,
  contentType: string,
): Promise<WatchExportObjectMetadataResult> {
  const stat = await fs.stat(filePath);
  if (stat.size >= MULTIPART_THRESHOLD_BYTES) {
    return putWatchExportMultipartFromFile(config, objectKey, filePath, contentType);
  }

  const body = createReadStream(filePath);
  const payloadHash = "UNSIGNED-PAYLOAD";
  const host = resolveHost(config);
  const headers: Record<string, string> = {
    host,
    "content-type": contentType,
    "x-amz-content-sha256": payloadHash,
  };
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  headers["x-amz-date"] = amzDate;
  const signedHeaderNames = Object.keys(headers).map((k) => k.toLowerCase()).sort();
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalHeaders = `${signedHeaderNames.map((name) => `${name}:${headers[name]}\n`).join("")}`;
  const canonicalUri = resolveCanonicalUri(config, objectKey);
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const credential = `${config.accessKeyId}/${scope}`;
  const canonicalRequest = ["PUT", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), config.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const url = new URL(config.endpoint);
  const pathPrefix = config.forcePathStyle ? `/${encodePath(config.bucket)}` : "";
  const requestUrl = `${url.protocol}//${host}${pathPrefix}/${encodePath(objectKey)}`;

  const response = await fetch(requestUrl, {
    method: "PUT",
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body: body as unknown as BodyInit,
    duplex: "half",
  } as RequestInit);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new InternalServerErrorException(`Watch export S3 upload failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const checksum = await sha256File(filePath);
  return {
    objectKey,
    bucket: config.bucket,
    contentType,
    fileSizeBytes: stat.size,
    checksum,
    etag: response.headers.get("etag") ?? undefined,
  };
}

type WatchExportObjectMetadataResult = {
  objectKey: string;
  bucket: string;
  contentType: string;
  fileSizeBytes: number;
  checksum: string;
  etag?: string;
};

async function sha256File(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

async function putWatchExportMultipartFromFile(
  config: WatchExportS3Config,
  objectKey: string,
  filePath: string,
  contentType: string,
): Promise<WatchExportObjectMetadataResult> {
  const stat = await fs.stat(filePath);
  const uploadId = await initiateMultipartUpload(config, objectKey, contentType);
  const parts: { partNumber: number; etag: string }[] = [];

  try {
    const buffer = await fs.readFile(filePath);
    let partNumber = 1;
    for (let offset = 0; offset < buffer.length; offset += MULTIPART_PART_SIZE) {
      const chunk = buffer.subarray(offset, Math.min(offset + MULTIPART_PART_SIZE, buffer.length));
      const etag = await uploadMultipartPart(config, objectKey, uploadId, partNumber, chunk);
      parts.push({ partNumber, etag });
      partNumber += 1;
    }
    const etag = await completeMultipartUpload(config, objectKey, uploadId, parts);
    const checksum = sha256Hex(buffer);
    return {
      objectKey,
      bucket: config.bucket,
      contentType,
      fileSizeBytes: stat.size,
      checksum,
      etag,
    };
  } catch (error) {
    await abortWatchExportMultipartUpload(config, objectKey, uploadId).catch(() => undefined);
    throw error;
  }
}

async function initiateMultipartUpload(config: WatchExportS3Config, objectKey: string, contentType: string) {
  const host = resolveHost(config);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const headers: Record<string, string> = { host, "content-type": contentType, "x-amz-date": amzDate, "x-amz-content-sha256": sha256Hex("") };
  const signedHeaderNames = Object.keys(headers).map((k) => k.toLowerCase()).sort();
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalHeaders = `${signedHeaderNames.map((name) => `${name}:${headers[name]}\n`).join("")}`;
  const canonicalUri = resolveCanonicalUri(config, objectKey);
  const query = "uploads=";
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const credential = `${config.accessKeyId}/${scope}`;
  const canonicalRequest = ["POST", canonicalUri, query, canonicalHeaders, signedHeaders, sha256Hex("")].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), config.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const url = new URL(config.endpoint);
  const pathPrefix = config.forcePathStyle ? `/${encodePath(config.bucket)}` : "";
  const requestUrl = `${url.protocol}//${host}${pathPrefix}/${encodePath(objectKey)}?uploads=`;

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  });
  if (!response.ok) throw new InternalServerErrorException("Failed to initiate multipart upload");
  const xml = await response.text();
  const match = xml.match(/<UploadId>([^<]+)<\/UploadId>/);
  if (!match) throw new InternalServerErrorException("Multipart upload ID missing from S3 response");
  return match[1];
}

async function uploadMultipartPart(
  config: WatchExportS3Config,
  objectKey: string,
  uploadId: string,
  partNumber: number,
  body: Buffer,
) {
  const host = resolveHost(config);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const payloadHash = sha256Hex(body);
  const headers: Record<string, string> = { host, "x-amz-date": amzDate, "x-amz-content-sha256": payloadHash };
  const signedHeaderNames = Object.keys(headers).map((k) => k.toLowerCase()).sort();
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalHeaders = `${signedHeaderNames.map((name) => `${name}:${headers[name]}\n`).join("")}`;
  const canonicalUri = resolveCanonicalUri(config, objectKey);
  const query = `partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`;
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const credential = `${config.accessKeyId}/${scope}`;
  const canonicalRequest = ["PUT", canonicalUri, query, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), config.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const url = new URL(config.endpoint);
  const pathPrefix = config.forcePathStyle ? `/${encodePath(config.bucket)}` : "";
  const requestUrl = `${url.protocol}//${host}${pathPrefix}/${encodePath(objectKey)}?${query}`;

  const response = await fetch(requestUrl, {
    method: "PUT",
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body: new Uint8Array(body),
  });
  if (!response.ok) throw new InternalServerErrorException(`Multipart part ${partNumber} upload failed`);
  const etag = response.headers.get("etag");
  if (!etag) throw new InternalServerErrorException(`Multipart part ${partNumber} missing ETag`);
  return etag.replace(/"/g, "");
}

async function completeMultipartUpload(
  config: WatchExportS3Config,
  objectKey: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[],
) {
  const body = `<CompleteMultipartUpload>${parts
    .sort((a, b) => a.partNumber - b.partNumber)
    .map((part) => `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>"${part.etag}"</ETag></Part>`)
    .join("")}</CompleteMultipartUpload>`;
  const host = resolveHost(config);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const payloadHash = sha256Hex(body);
  const headers: Record<string, string> = {
    host,
    "content-type": "application/xml",
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
  };
  const signedHeaderNames = Object.keys(headers).map((k) => k.toLowerCase()).sort();
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalHeaders = `${signedHeaderNames.map((name) => `${name}:${headers[name]}\n`).join("")}`;
  const canonicalUri = resolveCanonicalUri(config, objectKey);
  const query = `uploadId=${encodeURIComponent(uploadId)}`;
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const credential = `${config.accessKeyId}/${scope}`;
  const canonicalRequest = ["POST", canonicalUri, query, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), config.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const url = new URL(config.endpoint);
  const pathPrefix = config.forcePathStyle ? `/${encodePath(config.bucket)}` : "";
  const requestUrl = `${url.protocol}//${host}${pathPrefix}/${encodePath(objectKey)}?${query}`;

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body,
  });
  if (!response.ok) throw new InternalServerErrorException("Failed to complete multipart upload");
  const xml = await response.text();
  const match = xml.match(/<ETag>([^<]+)<\/ETag>/);
  return match?.[1]?.replace(/"/g, "") ?? undefined;
}

export async function abortWatchExportMultipartUpload(config: WatchExportS3Config, objectKey: string, uploadId: string) {
  const host = resolveHost(config);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const headers: Record<string, string> = { host, "x-amz-date": amzDate, "x-amz-content-sha256": sha256Hex("") };
  const signedHeaderNames = Object.keys(headers).map((k) => k.toLowerCase()).sort();
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalHeaders = `${signedHeaderNames.map((name) => `${name}:${headers[name]}\n`).join("")}`;
  const canonicalUri = resolveCanonicalUri(config, objectKey);
  const query = `uploadId=${encodeURIComponent(uploadId)}`;
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const credential = `${config.accessKeyId}/${scope}`;
  const canonicalRequest = ["DELETE", canonicalUri, query, canonicalHeaders, signedHeaders, sha256Hex("")].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), config.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const url = new URL(config.endpoint);
  const pathPrefix = config.forcePathStyle ? `/${encodePath(config.bucket)}` : "";
  const requestUrl = `${url.protocol}//${host}${pathPrefix}/${encodePath(objectKey)}?${query}`;
  await fetch(requestUrl, {
    method: "DELETE",
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  });
}

export async function deleteWatchExportObject(config: WatchExportS3Config, objectKey: string) {
  const host = resolveHost(config);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const headers: Record<string, string> = { host, "x-amz-date": amzDate, "x-amz-content-sha256": sha256Hex("") };
  const signedHeaderNames = Object.keys(headers).map((k) => k.toLowerCase()).sort();
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalHeaders = `${signedHeaderNames.map((name) => `${name}:${headers[name]}\n`).join("")}`;
  const canonicalUri = resolveCanonicalUri(config, objectKey);
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const credential = `${config.accessKeyId}/${scope}`;
  const canonicalRequest = ["DELETE", canonicalUri, "", canonicalHeaders, signedHeaders, sha256Hex("")].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), config.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const url = new URL(config.endpoint);
  const pathPrefix = config.forcePathStyle ? `/${encodePath(config.bucket)}` : "";
  const requestUrl = `${url.protocol}//${host}${pathPrefix}/${encodePath(objectKey)}`;
  const response = await fetch(requestUrl, {
    method: "DELETE",
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  });
  if (!response.ok && response.status !== 404) {
    throw new InternalServerErrorException(`Failed to delete watch export object (${response.status})`);
  }
}

export async function headWatchExportObject(config: WatchExportS3Config, objectKey: string) {
  const host = resolveHost(config);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const headers: Record<string, string> = { host, "x-amz-date": amzDate, "x-amz-content-sha256": sha256Hex("") };
  const signedHeaderNames = Object.keys(headers).map((k) => k.toLowerCase()).sort();
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalHeaders = `${signedHeaderNames.map((name) => `${name}:${headers[name]}\n`).join("")}`;
  const canonicalUri = resolveCanonicalUri(config, objectKey);
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const credential = `${config.accessKeyId}/${scope}`;
  const canonicalRequest = ["HEAD", canonicalUri, "", canonicalHeaders, signedHeaders, sha256Hex("")].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), config.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const url = new URL(config.endpoint);
  const pathPrefix = config.forcePathStyle ? `/${encodePath(config.bucket)}` : "";
  const requestUrl = `${url.protocol}//${host}${pathPrefix}/${encodePath(objectKey)}`;
  const response = await fetch(requestUrl, {
    method: "HEAD",
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new InternalServerErrorException(`Failed to read watch export object metadata (${response.status})`);
  return {
    objectKey,
    bucket: config.bucket,
    contentType: response.headers.get("content-type") ?? "text/csv",
    fileSizeBytes: Number(response.headers.get("content-length") ?? 0),
    etag: response.headers.get("etag") ?? undefined,
  };
}

export function buildWatchExportObjectKey(environment: string, jobId: string, createdAt = new Date()) {
  const year = createdAt.getUTCFullYear();
  const month = String(createdAt.getUTCMonth() + 1).padStart(2, "0");
  return `watch-fleet-exports/${environment}/${year}/${month}/${jobId}.csv`;
}

export async function streamToFile(stream: Readable, filePath: string) {
  const { createWriteStream } = await import("fs");
  await new Promise<void>((resolve, reject) => {
    const writer = createWriteStream(filePath);
    stream.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
    stream.on("error", reject);
  });
}
