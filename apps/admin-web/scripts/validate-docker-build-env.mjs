#!/usr/bin/env node
/**
 * Fails the Docker image build when required NEXT_PUBLIC_* build-args are missing or invalid.
 * Invoked from apps/admin-web/Dockerfile before `next build`.
 */

const DEPLOYABLE_APP_ENVS = new Set(["staging", "production"]);

const STAGING_PROJECT_MARKERS = ["the-eye-2stg"];
const PRODUCTION_PROJECT_MARKERS = ["the-eye-2pd-d0217"];
const PRODUCTION_API_HOST = "api.theeye.com.ng";
const STAGING_API_HOST = "staging-api.theeye.com.ng";
const STAGING_ADMIN_HOST = "staging-dashboard8jps.theeye.com.ng";

function fail(message) {
  console.error(`[admin-web docker build] ${message}`);
  process.exit(1);
}

function apiHostname(value) {
  try {
    if (!value.startsWith("http://") && !value.startsWith("https://")) return null;
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hasMarker(value, markers) {
  const lower = value.toLowerCase();
  return markers.some((marker) => lower.includes(marker));
}

const appEnv = process.env.NEXT_PUBLIC_APP_ENV?.trim();
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

if (!appEnv) {
  fail("NEXT_PUBLIC_APP_ENV build-arg is required (staging | production)");
}

if (!DEPLOYABLE_APP_ENVS.has(appEnv)) {
  fail(`NEXT_PUBLIC_APP_ENV must be staging or production for Docker images (received "${appEnv}")`);
}

if (!apiBaseUrl) {
  fail("NEXT_PUBLIC_API_BASE_URL build-arg is required");
}

const lowerApi = apiBaseUrl.toLowerCase();
if (lowerApi.includes("localhost") || lowerApi.includes("127.0.0.1")) {
  fail(`${appEnv} images must not use localhost API URLs`);
}

if (apiBaseUrl.startsWith("http://")) {
  fail(`${appEnv} images must use HTTPS API URLs`);
}

if (apiBaseUrl.startsWith("https://")) {
  const host = apiHostname(apiBaseUrl);
  if (appEnv === "staging" && host === STAGING_ADMIN_HOST) {
    fail("Staging image must not use admin dashboard hostname as API URL — use https://staging-api.theeye.com.ng/v1");
  }
  if (appEnv === "staging" && host === PRODUCTION_API_HOST) {
    fail("Staging image must not target production API hosts");
  }
  if (appEnv === "production" && host === STAGING_API_HOST) {
    fail("Production image must not target staging API hosts");
  }
  if (appEnv === "staging" && hasMarker(apiBaseUrl, PRODUCTION_PROJECT_MARKERS)) {
    fail("Staging image must not target production Firebase configuration");
  }
  if (appEnv === "production" && hasMarker(apiBaseUrl, STAGING_PROJECT_MARKERS)) {
    fail("Production image must not target staging Firebase configuration");
  }
} else if (!apiBaseUrl.startsWith("/")) {
  fail("NEXT_PUBLIC_API_BASE_URL must be an HTTPS URL or a relative path such as /v1");
}

console.log(`[admin-web docker build] validated APP_ENV=${appEnv} API_BASE_URL=${apiBaseUrl}`);
