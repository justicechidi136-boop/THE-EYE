#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { run } = require("../staging-storage-smoke.cjs");

const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function serviceBlock(composeSource, serviceName) {
  const normalized = composeSource.replace(/\r\n/g, "\n");
  const start = normalized.indexOf(`  ${serviceName}:\n`);
  if (start === -1) return "";
  const rest = normalized.slice(start + `  ${serviceName}:\n`.length);
  const nextService = rest.search(/\n  [a-zA-Z0-9_-]+:\n/);
  return nextService === -1 ? rest : rest.slice(0, nextService);
}

const signedUploadUrl =
  "https://storage.googleapis.com/the-eye-2stg.firebasestorage.app/evidence/storage-smoke.png?X-Goog-Signature=abc123";
const signedGetUrl =
  "https://storage.googleapis.com/the-eye-2stg.firebasestorage.app/evidence/storage-smoke.png?X-Goog-Signature=def456";

const baseEnv = {
  STAGING_API_BASE_URL: "https://staging-api.theeye.com.ng/v1",
  THE_EYE_APP_ENV: "staging",
  FIREBASE_PROJECT_ID: "the-eye-2stg",
  STORAGE_PROVIDER: "firebase",
  FIREBASE_STORAGE_BUCKET: "the-eye-2stg.firebasestorage.app",
};

function makeFetch({ expectToken, loginToken = "runtime-access-token" } = {}) {
  const calls = [];
  let uploadedBody = null;

  async function fetchMock(url, options = {}) {
    calls.push({ url: String(url), options });

    if (String(url).endsWith("/auth/login")) {
      return new Response(JSON.stringify({ accessToken: loginToken, refreshToken: "runtime-refresh-token" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (String(url).endsWith("/storage/presign")) {
      assert(options.headers?.Authorization === `Bearer ${expectToken ?? loginToken}`, "presign must use the resolved bearer token");
      return new Response(
        JSON.stringify({
          uploadUrl: signedUploadUrl,
          getUrl: signedGetUrl,
          objectKey: "evidence/storage-smoke.png",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (String(url) === signedUploadUrl) {
      uploadedBody = Buffer.from(await new Response(options.body).arrayBuffer());
      return new Response("", { status: 200 });
    }

    if (String(url) === signedGetUrl) {
      return new Response(uploadedBody, { status: 200 });
    }

    return new Response("not found", { status: 404 });
  }

  return { fetchMock, calls };
}

async function expectPass(name, env, fetchOptions = {}) {
  const logs = [];
  const { fetchMock, calls } = makeFetch(fetchOptions);
  await run({ env, fetch: fetchMock, log: (line) => logs.push(String(line)) });
  assert(logs.some((line) => line === "PASS storage smoke"), `${name} should pass storage smoke`);
  return { logs: logs.join("\n"), calls };
}

async function expectFail(name, env, expectedMessage) {
  const logs = [];
  const { fetchMock, calls } = makeFetch();
  try {
    await run({ env, fetch: fetchMock, log: (line) => logs.push(String(line)) });
    assert(false, `${name} expected failure`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(message.includes(expectedMessage), `${name} expected message ${expectedMessage}, got ${message}`);
  }
  return { logs: logs.join("\n"), calls };
}

const suppliedToken = await expectPass("supplied token still works", {
  ...baseEnv,
  STAGING_STORAGE_SMOKE_TOKEN: "supplied-token",
}, { expectToken: "supplied-token" });
assert(!suppliedToken.calls.some((call) => String(call.url).endsWith("/auth/login")), "supplied token must not trigger citizen login");

const password = "citizen-password-secret";
const loginToken = "login-token-secret";
const credentialLogin = await expectPass("missing token triggers citizen login", {
  ...baseEnv,
  STAGING_TEST_CITIZEN_EMAIL: "staging.citizen@theeye.local",
  STAGING_TEST_CITIZEN_PASSWORD: password,
}, { loginToken });
assert(credentialLogin.calls.some((call) => String(call.url).endsWith("/auth/login")), "missing token must trigger citizen login");
assert(credentialLogin.logs.includes("event=auth status=200 account=citizen"), "credential login must log only safe auth status");

const missingCredentials = await expectFail("missing citizen credentials fails safely", {
  ...baseEnv,
}, "STAGING_TEST_CITIZEN_EMAIL and STAGING_TEST_CITIZEN_PASSWORD are required");
assert(missingCredentials.calls.length === 0, "missing credentials must fail before network calls");

const productionRefusal = await expectFail("production environment refuses credential login", {
  ...baseEnv,
  THE_EYE_APP_ENV: "production",
  FIREBASE_PROJECT_ID: "the-eye-2pd-d0217",
  STAGING_TEST_CITIZEN_EMAIL: "staging.citizen@theeye.local",
  STAGING_TEST_CITIZEN_PASSWORD: password,
}, "credential login requires THE_EYE_APP_ENV=staging");
assert(productionRefusal.calls.length === 0, "production refusal must fail before network calls");

const combinedLogs = `${suppliedToken.logs}\n${credentialLogin.logs}\n${missingCredentials.logs}\n${productionRefusal.logs}`;
assert(!combinedLogs.includes(loginToken), "access token must never be logged");
assert(!combinedLogs.includes(password), "password must never be logged");
assert(!combinedLogs.includes(signedUploadUrl), "complete signed upload URL must never be logged");
assert(!combinedLogs.includes("X-Goog-Signature"), "signed URL signature parameters must never be logged");

const deployWorkflow = readFileSync(".github/workflows/deploy.yml", "utf8");
assert(deployWorkflow.includes("run_storage_proof:"), "deploy workflow must define run_storage_proof input");
assert(deployWorkflow.includes("default: false"), "run_storage_proof must default false");
assert(
  deployWorkflow.includes("export RUN_STORAGE_PROOF=${{ github.event.inputs.run_storage_proof }}"),
  "deploy workflow must export RUN_STORAGE_PROOF",
);
assert(!deployWorkflow.includes("script_stop: true"), "deploy workflow must not reintroduce script_stop");
assert(deployWorkflow.includes("set -euo pipefail"), "deploy SSH script must retain set -euo pipefail");

const deployScript = readFileSync("scripts/deploy-staging-vps-ci.sh", "utf8");
assert(deployScript.includes('RUN_STORAGE_PROOF="${RUN_STORAGE_PROOF:-false}"'), "deploy script must default RUN_STORAGE_PROOF to false");
assert(deployScript.includes('if [[ "$RUN_STORAGE_PROOF" == "true" ]]; then'), "deploy script must gate storage proof on true");
assert(deployScript.includes("scripts/staging-storage-smoke.cjs"), "deploy script must invoke staging storage smoke");
assert(!deployScript.includes("api-tools scripts/staging-storage-smoke.cjs"), "storage proof must not run through api-tools");
assert(deployScript.includes('"${COMPOSE[@]}" exec -T \\'), "storage proof must use docker compose exec -T");
assert(deployScript.includes("api \\\n    node scripts/staging-storage-smoke.cjs"), "storage proof must execute inside the running API service");
assert(deployScript.includes("SKIP storage proof"), "deploy script must skip storage proof unless enabled");

const compose = readFileSync("infra/docker/docker-compose.yml", "utf8");
const apiBlock = serviceBlock(compose, "api");
const apiToolsBlock = serviceBlock(compose, "api-tools");
assert(apiBlock.includes("- the-eye-internal") && apiBlock.includes("- the-eye-public"), "api service must keep public egress network");
assert(apiBlock.includes("env_file:") && apiBlock.includes("../../.env"), "api service must inherit the VPS .env");
assert(apiToolsBlock.includes("- the-eye-internal"), "api-tools must remain on internal network");
assert(!apiToolsBlock.includes("- the-eye-public"), "api-tools must not gain public egress for storage proof");

const apiDockerfile = readFileSync("apps/api/Dockerfile", "utf8");
assert(apiDockerfile.includes("COPY . ."), "API image build must include repository scripts before deploy packaging");
assert(apiDockerfile.includes("pnpm --filter @the-eye/api deploy --prod /app/deploy"), "API production image must use deploy-prod packaging");

if (failures.length) {
  console.error("Staging storage certification tests failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Staging storage certification tests passed.");
