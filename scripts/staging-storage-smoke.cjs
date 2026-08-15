#!/usr/bin/env node
const crypto = require("crypto");

const apiBaseUrl = String(process.env.STAGING_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const token = String(process.env.STAGING_STORAGE_SMOKE_TOKEN || process.env.STAGING_AUTH_TOKEN || "");
const expectedHost = String(process.env.STAGING_STORAGE_HOST || process.env.THE_EYE_STORAGE_SERVER_NAME || "").trim().toLowerCase();

function fail(message) {
  console.error(`FAIL storage smoke: ${message}`);
  process.exit(1);
}

function logSafe(fields) {
  console.log(
    Object.entries(fields)
      .map(([key, value]) => `${key}=${value}`)
      .join(" "),
  );
}

function safeUrlShape(rawUrl) {
  const url = new URL(rawUrl);
  return {
    scheme: url.protocol.replace(":", ""),
    host: url.hostname.toLowerCase(),
    port: url.port || "(default)",
    hasQuery: url.searchParams.toString().length > 0,
  };
}

async function main() {
  if (!apiBaseUrl) fail("STAGING_API_BASE_URL or NEXT_PUBLIC_API_BASE_URL is required");
  if (!token) fail("STAGING_STORAGE_SMOKE_TOKEN is required");
  if (!expectedHost) fail("STAGING_STORAGE_HOST or THE_EYE_STORAGE_SERVER_NAME is required");

  const presignEndpoint = `${apiBaseUrl}/storage/presign`;
  const objectBody = Buffer.from(`the-eye-storage-smoke:${crypto.randomUUID()}\n`, "utf8");
  const fileName = `storage-smoke-${Date.now()}.png`;
  const contentType = "image/png";

  const presignResponse = await fetch(presignEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName,
      contentType,
      sizeBytes: objectBody.length,
    }),
  });

  if (!presignResponse.ok) {
    fail(`presign status=${presignResponse.status}`);
  }

  const presign = await presignResponse.json();
  const uploadUrl = presign.uploadUrl || presign.data?.uploadUrl;
  if (typeof uploadUrl !== "string" || !uploadUrl) fail("presign response did not include uploadUrl");

  const shape = safeUrlShape(uploadUrl);
  logSafe({
    event: "presign",
    scheme: shape.scheme,
    host: shape.host,
    port: shape.port,
    hasQuery: shape.hasQuery,
  });

  if (shape.scheme !== "https") fail(`upload URL scheme must be https, got ${shape.scheme}`);
  if (shape.host !== expectedHost) fail(`upload URL host ${shape.host} did not match expected storage host`);
  if (shape.host === "minio" || shape.host.includes("localhost") || shape.host.endsWith(".local")) {
    fail("upload URL host is not publicly reachable");
  }
  if (!shape.hasQuery) fail("upload URL is missing presigned query parameters");

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: objectBody,
  });

  logSafe({
    event: "put",
    method: "PUT",
    status: uploadResponse.status,
  });

  if (!uploadResponse.ok) {
    fail(`PUT upload failed status=${uploadResponse.status}`);
  }

  const getUrl = presign.getUrl || presign.downloadUrl || presign.data?.getUrl || presign.data?.downloadUrl;
  if (typeof getUrl === "string" && getUrl) {
    const getShape = safeUrlShape(getUrl);
    logSafe({
      event: "get-presign",
      scheme: getShape.scheme,
      host: getShape.host,
      hasQuery: getShape.hasQuery,
    });
    if (getShape.scheme !== "https" || getShape.host !== expectedHost || !getShape.hasQuery) {
      fail("GET URL shape is invalid");
    }
    const getResponse = await fetch(getUrl, { method: "GET" });
    const downloaded = Buffer.from(await getResponse.arrayBuffer());
    logSafe({ event: "get", method: "GET", status: getResponse.status });
    if (!getResponse.ok || !downloaded.equals(objectBody)) {
      fail("GET verification failed");
    }
  } else {
    console.log("SKIP get-presign unsupported_by_storage_presign_endpoint");
  }

  console.log("PASS storage smoke");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
