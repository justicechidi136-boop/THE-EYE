#!/usr/bin/env node
/**
 * Development-only: submit one FCM message to one explicit internal test device token.
 * Does not target topics, groups, jurisdictions, or all users.
 *
 * Usage:
 *   pnpm run fcm:test-device -- --token=<fcm-registration-token> --confirm
 *
 * Optional:
 *   --title="THE EYE test"
 *   --body="Internal device push verification"
 */
const { createSign } = require("crypto");
const path = require("path");
const { loadProductionEnv } = require("./firebase/guard-production.cjs");
const { PROD_PROJECT_ID } = require("./firebase/constants.cjs");

function parseArgs(argv) {
  const args = { confirm: false };
  for (const entry of argv) {
    if (entry === "--confirm") args.confirm = true;
    else if (entry.startsWith("--token=")) args.token = entry.slice("--token=".length).trim();
    else if (entry.startsWith("--title=")) args.title = entry.slice("--title=".length);
    else if (entry.startsWith("--body=")) args.body = entry.slice("--body=".length);
  }
  return args;
}

function normalizePrivateKey(value) {
  return String(value ?? "").replace(/\\n/g, "\n").trim();
}

function maskToken(token) {
  const trimmed = String(token ?? "").trim();
  return trimmed.length > 8 ? `...${trimmed.slice(-8)}` : "[short-token]";
}

function assertDevOnly(env) {
  if (env.FCM_ALLOW_SIMULATION === "true" || env.FCM_ALLOW_SIMULATION === "1") {
    throw new Error("FCM_ALLOW_SIMULATION must be false for live device tests");
  }
  if (env.FCM_SIMULATION_MODE === "true" || env.FCM_SIMULATION_MODE === "1") {
    throw new Error("FCM_SIMULATION_MODE must be false for live device tests");
  }
  if (env.FCM_MODE !== "real") {
    throw new Error("FCM_MODE must be real for live device tests");
  }
  if (!env.FCM_PROJECT_ID || !env.FCM_CLIENT_EMAIL || !normalizePrivateKey(env.FCM_PRIVATE_KEY)) {
    throw new Error("FCM credentials are incomplete");
  }
}

async function getAccessToken(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${claim}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKey, "base64url");
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) {
    throw new Error(body.error ?? "Unable to obtain FCM access token");
  }
  return body.access_token;
}

function classifyOutcome(status, message, httpOk, providerMessageId) {
  if (httpOk && providerMessageId) return "provider_accepted";
  const normalized = `${status ?? ""} ${message ?? ""}`.toUpperCase();
  if (normalized.includes("NOT_FOUND") || normalized.includes("UNREGISTERED")) return "invalid_token";
  if (normalized.includes("INVALID_ARGUMENT") && (normalized.includes("TOKEN") || normalized.includes("REGISTRATION"))) {
    return "invalid_token";
  }
  return "failed";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.token) {
    console.error("Usage: pnpm run fcm:test-device -- --token=<fcm-registration-token> --confirm");
    process.exit(1);
  }
  if (!args.confirm) {
    console.error("Refusing to send without --confirm. This submits one message to one explicit device token.");
    process.exit(1);
  }

  const repoRoot = path.join(__dirname, "..");
  const env = loadProductionEnv(repoRoot);
  assertDevOnly(env);

  const projectId = env.FCM_PROJECT_ID.trim();
  const clientEmail = env.FCM_CLIENT_EMAIL.trim();
  const privateKey = normalizePrivateKey(env.FCM_PRIVATE_KEY);
  const title = args.title ?? "THE EYE internal device test";
  const body = args.body ?? "Safe single-device FCM verification";

  console.log(
    JSON.stringify(
      {
        phase: "submitted",
        projectId,
        fcmMode: env.FCM_MODE,
        tokenSuffix: maskToken(args.token),
        note: "Provider acceptance is not device delivery.",
      },
      null,
      2,
    ),
  );

  const accessToken = await getAccessToken(clientEmail, privateKey);
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token: args.token,
        notification: { title, body },
        data: {
          type: "internal_device_test",
          priority: "Normal",
        },
      },
    }),
  });

  const payload = await response.json();
  const outcome = classifyOutcome(payload.error?.status, payload.error?.message, response.ok, payload.name);

  console.log(
    JSON.stringify(
      {
        phase: outcome === "provider_accepted" ? "provider_accepted" : outcome,
        projectId,
        tokenSuffix: maskToken(args.token),
        providerMessageId: payload.name ?? null,
        error: payload.error?.message ?? (response.ok ? null : `HTTP ${response.status}`),
        reminder: "Confirm physical device receipt manually; provider acceptance is not device delivery.",
      },
      null,
      2,
    ),
  );

  if (outcome !== "provider_accepted") process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
