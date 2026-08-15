#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function runGate(extraEnv) {
  return spawnSync(process.execPath, ["scripts/ci/validate-staging-deploy-gate.mjs"], {
    encoding: "utf8",
    env: {
      ...process.env,
      NEXT_PUBLIC_API_BASE_URL: "https://staging-api.theeye.com.ng/v1",
      THE_EYE_APP_ENV: "staging",
      FIREBASE_PROJECT_ID: "the-eye-2stg",
      FCM_PROJECT_ID: "the-eye-2stg",
      NEXT_PUBLIC_APP_ENV: "staging",
      ...extraEnv,
    },
  });
}

function expectGatePass(name, env) {
  const result = runGate(env);
  assert(result.status === 0, `${name} expected pass, got status=${result.status} stderr=${result.stderr}`);
}

function expectGateFail(name, env, expectedMessage) {
  const result = runGate(env);
  assert(result.status !== 0, `${name} expected failure`);
  assert(
    `${result.stdout}\n${result.stderr}`.includes(expectedMessage),
    `${name} expected message: ${expectedMessage}`,
  );
}

expectGatePass("staging Firebase provider accepted", {
  STORAGE_PROVIDER: "firebase",
  FIREBASE_STORAGE_BUCKET: "the-eye-2stg.firebasestorage.app",
  FCM_CLIENT_EMAIL: "firebase-adminsdk@example.iam.gserviceaccount.com",
  FCM_PRIVATE_KEY: "present",
});

expectGateFail("staging production Firebase project rejected", {
  STORAGE_PROVIDER: "firebase",
  FIREBASE_PROJECT_ID: "the-eye-2pd-d0217",
  FIREBASE_STORAGE_BUCKET: "the-eye-2stg.firebasestorage.app",
  FCM_CLIENT_EMAIL: "firebase-adminsdk@example.iam.gserviceaccount.com",
  FCM_PRIVATE_KEY: "present",
}, "production Firebase project");

expectGateFail("staging production Firebase bucket rejected", {
  STORAGE_PROVIDER: "firebase",
  FIREBASE_STORAGE_BUCKET: "the-eye-2pd-d0217.firebasestorage.app",
  FCM_CLIENT_EMAIL: "firebase-adminsdk@example.iam.gserviceaccount.com",
  FCM_PRIVATE_KEY: "present",
}, "production Firebase Storage bucket");

expectGatePass("Firebase provider does not require STAGING_STORAGE_HOST", {
  STORAGE_PROVIDER: "firebase",
  FIREBASE_STORAGE_BUCKET: "the-eye-2stg.firebasestorage.app",
  FCM_SERVICE_ACCOUNT_JSON: "present",
});

expectGateFail("S3 provider still requires storage host", {
  STORAGE_PROVIDER: "s3",
}, "STAGING_STORAGE_HOST is required");

expectGateFail("invalid provider fails closed", {
  STORAGE_PROVIDER: "filesystem",
}, "STORAGE_PROVIDER must be one of");

const deployWorkflow = readFileSync(".github/workflows/deploy.yml", "utf8");
assert(!deployWorkflow.includes("script_stop: true"), "staging SSH deploy must not enable script_stop");
assert(deployWorkflow.includes("set -euo pipefail"), "staging SSH deploy must retain shell fail-fast guard");
assert(deployWorkflow.includes("STORAGE_PROVIDER: ${{ vars.STORAGE_PROVIDER }}"), "deploy preflight must export STORAGE_PROVIDER");
assert(deployWorkflow.includes("FIREBASE_STORAGE_BUCKET: ${{ vars.FIREBASE_STORAGE_BUCKET }}"), "deploy preflight must export FIREBASE_STORAGE_BUCKET");
assert(deployWorkflow.includes("export STORAGE_PROVIDER='${{ vars.STORAGE_PROVIDER }}'"), "SSH deploy must export STORAGE_PROVIDER");
assert(deployWorkflow.includes("export FIREBASE_STORAGE_BUCKET='${{ vars.FIREBASE_STORAGE_BUCKET }}'"), "SSH deploy must export FIREBASE_STORAGE_BUCKET");
assert(
  deployWorkflow.includes('if [ "${STORAGE_PROVIDER}" = "s3" ] || [ "${STORAGE_PROVIDER}" = "minio" ]; then'),
  "Firebase mode must not force legacy S3 public endpoint exports",
);
assert(
  deployWorkflow.includes("export RUN_MIGRATIONS=${{ github.event.inputs.run_migrations }}"),
  "SSH deploy must export RUN_MIGRATIONS",
);

const deployScript = readFileSync("scripts/deploy-staging-vps-ci.sh", "utf8");
assert(deployScript.includes('RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"'), "deploy script must default RUN_MIGRATIONS to true");
assert(deployScript.includes('if [[ "$RUN_MIGRATIONS" == "true" ]]; then'), "run_migrations=true must run api-migrate path");
assert(deployScript.includes("Skipping staging migrations"), "run_migrations=false must skip api-migrate path");

const storageSmoke = readFileSync("scripts/staging-storage-smoke.cjs", "utf8");
assert(storageSmoke.includes('provider = String(process.env.STORAGE_PROVIDER || "s3")'), "storage smoke must read STORAGE_PROVIDER");
assert(storageSmoke.includes("storage.googleapis.com"), "storage smoke must accept GCS signed URLs");
assert(storageSmoke.includes("firebase upload URL must not point at legacy MinIO storage"), "storage smoke must reject legacy MinIO in Firebase mode");
assert(storageSmoke.includes("STAGING_STORAGE_HOST or THE_EYE_STORAGE_SERVER_NAME is required in s3 mode"), "storage smoke must preserve S3 host requirement");

if (failures.length) {
  console.error("Staging Firebase storage cutover tests failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Staging Firebase storage cutover tests passed.");
