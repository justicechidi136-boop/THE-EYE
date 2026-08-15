#!/usr/bin/env node
/**
 * Staging deploy preflight — validates mandatory GitHub environment vars.
 * Does not print secret values; only presence and approved shapes.
 */
import {
  logDeployUrlValidationFailure,
  STAGING_CANONICAL_API_URL,
  validateStagingApiUrl,
} from "./deploy-api-url-validation.mjs";

const STAGING_FIREBASE_PROJECT = "the-eye-2stg";
const STAGING_STORAGE_HOST_SUFFIX = ".theeye.com.ng";
const errors = [];

function env(name) {
  return String(process.env[name] ?? "").trim();
}

function requireExact(name, expected) {
  const value = env(name);
  if (!value) {
    errors.push(`${name} is required in GitHub staging environment`);
    return;
  }
  if (value !== expected) {
    errors.push(`${name} must be exactly ${expected}`);
  }
}

const apiUrl = env("NEXT_PUBLIC_API_BASE_URL");
if (!apiUrl) {
  errors.push("NEXT_PUBLIC_API_BASE_URL is required in GitHub staging environment");
} else {
  const apiCheck = validateStagingApiUrl(apiUrl);
  if (!apiCheck.ok) {
    logDeployUrlValidationFailure(apiCheck);
    errors.push(`NEXT_PUBLIC_API_BASE_URL failed deploy URL validation (${apiCheck.code})`);
  }
}

requireExact("THE_EYE_APP_ENV", "staging");
requireExact("FIREBASE_PROJECT_ID", STAGING_FIREBASE_PROJECT);
requireExact("FCM_PROJECT_ID", STAGING_FIREBASE_PROJECT);

const appEnv = env("NEXT_PUBLIC_APP_ENV");
if (appEnv && appEnv !== "staging") {
  errors.push("NEXT_PUBLIC_APP_ENV must be staging when set");
}

const storageHost = env("STAGING_STORAGE_HOST");
if (!storageHost) {
  errors.push("STAGING_STORAGE_HOST is required in GitHub staging environment");
} else {
  if (/^https?:\/\//i.test(storageHost)) {
    errors.push("STAGING_STORAGE_HOST must be a hostname only, not a URL");
  }
  if (storageHost.includes("/") || storageHost.includes("?") || storageHost.includes("#")) {
    errors.push("STAGING_STORAGE_HOST must not include a path, query, or fragment");
  }
  if (storageHost.includes(":")) {
    errors.push("STAGING_STORAGE_HOST must not include a port");
  }
  const normalizedStorageHost = storageHost.toLowerCase();
  const blockedHosts = new Set([
    "minio",
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "api.theeye.com.ng",
    "staging-api.theeye.com.ng",
    "staging-dashboard8jps.theeye.com.ng",
    "staging-livekit.theeye.com.ng",
  ]);
  if (blockedHosts.has(normalizedStorageHost)) {
    errors.push("STAGING_STORAGE_HOST must be a dedicated public storage hostname");
  }
  if (
    normalizedStorageHost.endsWith(".internal") ||
    normalizedStorageHost.endsWith(".local") ||
    normalizedStorageHost.includes("docker") ||
    normalizedStorageHost.includes("minio")
  ) {
    errors.push("STAGING_STORAGE_HOST must not be a Docker-only or private hostname");
  }
  if (!normalizedStorageHost.endsWith(STAGING_STORAGE_HOST_SUFFIX)) {
    errors.push(`STAGING_STORAGE_HOST must be under the owned staging domain ${STAGING_STORAGE_HOST_SUFFIX}`);
  }
  if (!normalizedStorageHost.includes("staging")) {
    errors.push("STAGING_STORAGE_HOST must be clearly staging-scoped");
  }
}

if (errors.length) {
  console.error("Staging deploy preflight failed (DEP-002):");
  for (const error of errors) console.error(`- ${error}`);
  console.error(`Approved staging API URL: ${STAGING_CANONICAL_API_URL}`);
  process.exit(1);
}

console.log("Staging deploy preflight passed.");
console.log(`NEXT_PUBLIC_API_BASE_URL host validated: staging-api.theeye.com.ng`);
console.log(`STAGING_STORAGE_HOST validated: ${storageHost}`);
