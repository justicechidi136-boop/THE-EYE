#!/usr/bin/env node
const crypto = require("crypto");

const STAGING_FIREBASE_PROJECT = "the-eye-2stg";
const STAGING_FIREBASE_BUCKET = "the-eye-2stg.firebasestorage.app";
const FIREBASE_HOSTS = new Set(["storage.googleapis.com", "firebasestorage.googleapis.com"]);

function readConfig(env = process.env) {
  return {
    apiBaseUrl: String(env.STAGING_API_BASE_URL || env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, ""),
    token: String(env.STAGING_STORAGE_SMOKE_TOKEN || env.STAGING_AUTH_TOKEN || ""),
    expectedHost: String(env.STAGING_STORAGE_HOST || env.THE_EYE_STORAGE_SERVER_NAME || "").trim().toLowerCase(),
    provider: String(env.STORAGE_PROVIDER || "s3").trim().toLowerCase(),
    expectedFirebaseBucket: String(env.FIREBASE_STORAGE_BUCKET || "").trim().toLowerCase(),
    appEnv: String(env.THE_EYE_APP_ENV || "").trim().toLowerCase(),
    firebaseProjectId: String(env.FIREBASE_PROJECT_ID || "").trim(),
    citizenEmail: String(env.STAGING_TEST_CITIZEN_EMAIL || "").trim(),
    citizenPassword: String(env.STAGING_TEST_CITIZEN_PASSWORD || ""),
  };
}

function createLogger(output = console.log) {
  return (fields) => output(
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

function normalizeAuthEndpoint(apiBaseUrl) {
  return apiBaseUrl.endsWith("/v1") ? `${apiBaseUrl}/auth/login` : `${apiBaseUrl}/v1/auth/login`;
}

function assertCredentialLoginAllowed(config) {
  if (config.appEnv !== "staging") throw new Error("credential login requires THE_EYE_APP_ENV=staging");
  if (config.firebaseProjectId !== STAGING_FIREBASE_PROJECT) {
    throw new Error("credential login requires the staging Firebase project");
  }
  if (config.provider !== "firebase") throw new Error("credential login requires STORAGE_PROVIDER=firebase");
  if (config.expectedFirebaseBucket !== STAGING_FIREBASE_BUCKET) {
    throw new Error("credential login requires the staging Firebase Storage bucket");
  }
}

async function resolveToken(config, fetchImpl, logSafe) {
  if (config.token) return config.token;

  assertCredentialLoginAllowed(config);

  if (!config.citizenEmail || !config.citizenPassword) {
    throw new Error("STAGING_TEST_CITIZEN_EMAIL and STAGING_TEST_CITIZEN_PASSWORD are required when no token is supplied");
  }

  const response = await fetchImpl(normalizeAuthEndpoint(config.apiBaseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: config.citizenEmail, password: config.citizenPassword }),
  });

  const requestId = response.headers?.get?.("x-request-id") || undefined;
  if (!response.ok) {
    const status = response.status || "unknown";
    throw new Error(`citizen login failed status=${status}${requestId ? ` requestId=${requestId}` : ""}`);
  }

  const payload = await response.json().catch(() => ({}));
  const accessToken = payload.accessToken || payload.token || payload.data?.accessToken || payload.data?.token;
  if (typeof accessToken !== "string" || !accessToken) {
    throw new Error(`citizen login failed status=${response.status || 200} category=missing_access_token`);
  }

  logSafe({ event: "auth", status: response.status || 200, account: "citizen" });
  return accessToken;
}

function inferObjectPath(presign, uploadUrl) {
  const directPath = presign.objectKey || presign.objectPath || presign.path || presign.data?.objectKey || presign.data?.objectPath || presign.data?.path;
  if (typeof directPath === "string" && directPath) return directPath.replace(/^\/+/, "");
  try {
    const url = new URL(uploadUrl);
    return url.pathname.replace(/^\/+/, "");
  } catch {
    return "unknown";
  }
}

function objectPrefix(objectPath) {
  const parts = objectPath.split("/").filter(Boolean);
  return parts.length > 1 ? `${parts[0]}/` : objectPath;
}

async function run(options = {}) {
  const env = options.env || process.env;
  const config = readConfig(env);
  const fetchImpl = options.fetch || fetch;
  const output = options.log || console.log;
  const logSafe = createLogger(output);
  const fail = (message) => {
    throw new Error(message);
  };

  if (!config.apiBaseUrl) fail("STAGING_API_BASE_URL or NEXT_PUBLIC_API_BASE_URL is required");
  if (!["firebase", "s3", "minio"].includes(config.provider)) fail("STORAGE_PROVIDER must be one of: firebase, s3, minio");
  if (config.provider === "firebase" && config.expectedFirebaseBucket !== STAGING_FIREBASE_BUCKET) {
    fail("FIREBASE_STORAGE_BUCKET must be the staging Firebase Storage bucket in firebase mode");
  }
  if ((config.provider === "s3" || config.provider === "minio") && !config.expectedHost) {
    fail("STAGING_STORAGE_HOST or THE_EYE_STORAGE_SERVER_NAME is required in s3 mode");
  }

  const authToken = await resolveToken(config, fetchImpl, logSafe);
  const presignEndpoint = `${config.apiBaseUrl}/storage/presign`;
  const objectBody = Buffer.from(`the-eye-storage-smoke:${crypto.randomUUID()}\n`, "utf8");
  const fileName = `storage-smoke-${Date.now()}.png`;
  const contentType = "image/png";
  const objectHash = crypto.createHash("sha256").update(objectBody).digest("hex");

  const presignResponse = await fetchImpl(presignEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
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
    provider: config.provider,
    scheme: shape.scheme,
    host: shape.host,
    port: shape.port,
    hasQuery: shape.hasQuery,
  });

  if (shape.scheme !== "https") fail(`upload URL scheme must be https, got ${shape.scheme}`);
  if (config.provider === "firebase") {
    if (!FIREBASE_HOSTS.has(shape.host)) fail(`upload URL host ${shape.host} is not an approved Firebase/GCS host`);
    if (uploadUrl.includes("minio") || shape.host === "storage-staging.theeye.com.ng") {
      fail("firebase upload URL must not point at legacy MinIO storage");
    }
    if (!uploadUrl.includes(config.expectedFirebaseBucket)) {
      fail("firebase upload URL did not reference the expected staging bucket");
    }
    if (!uploadUrl.includes("X-Goog-Signature=") && !uploadUrl.includes("X-Goog-Algorithm=")) {
      fail("firebase upload URL is missing signed Google query parameters");
    }
  } else if (shape.host !== config.expectedHost) {
    fail(`upload URL host ${shape.host} did not match expected storage host`);
  }
  if (shape.host === "minio" || shape.host.includes("localhost") || shape.host.endsWith(".local")) {
    fail("upload URL host is not publicly reachable");
  }
  if (!shape.hasQuery) fail("upload URL is missing presigned query parameters");

  const uploadResponse = await fetchImpl(uploadUrl, {
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
    if (config.provider === "firebase") {
      if (getShape.scheme !== "https" || !FIREBASE_HOSTS.has(getShape.host) || !getShape.hasQuery) {
        fail("GET URL shape is invalid");
      }
      if (getUrl.includes("minio") || getShape.host === "storage-staging.theeye.com.ng") {
        fail("firebase GET URL must not point at legacy MinIO storage");
      }
    } else if (getShape.scheme !== "https" || getShape.host !== config.expectedHost || !getShape.hasQuery) {
      fail("GET URL shape is invalid");
    }
    const getResponse = await fetchImpl(getUrl, { method: "GET" });
    const downloaded = Buffer.from(await getResponse.arrayBuffer());
    logSafe({ event: "get", method: "GET", status: getResponse.status });
    if (!getResponse.ok || !downloaded.equals(objectBody)) {
      fail("GET verification failed");
    }
  } else if (config.provider === "firebase") {
    fail("firebase GET URL is required for runtime certification");
  } else {
    output("SKIP get-presign unsupported_by_storage_presign_endpoint");
  }

  const objectPath = inferObjectPath(presign, uploadUrl);
  logSafe({
    event: "object",
    bucket: config.provider === "firebase" ? config.expectedFirebaseBucket : "(s3)",
    pathPrefix: objectPrefix(objectPath),
    sizeBytes: objectBody.length,
    sha256: objectHash,
  });
  output("PASS storage smoke");
}

async function main() {
  try {
    await run();
  } catch (error) {
    console.error(`FAIL storage smoke: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  normalizeAuthEndpoint,
  readConfig,
  run,
};
