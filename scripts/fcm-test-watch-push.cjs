#!/usr/bin/env node
/**
 * Development/staging-only: submit one watch-specific FCM message to one token.
 *
 * Usage:
 *   pnpm run fcm:test-watch -- --token=<fcm-registration-token> --confirm
 *
 * Optional:
 *   --category=FamilySosAlert
 *   --title="THE EYE watch test"
 *   --body="Watch push verification"
 */
const { createSign } = require("crypto");
const path = require("path");
const { loadProductionEnv } = require("./firebase/guard-production.cjs");

const WATCH_CATEGORIES = new Set([
  "SosAck",
  "FamilySosAlert",
  "EmergencyAlert",
  "IncidentStatusUpdate",
  "BroadcastAlert",
  "MissingPersonAlert",
  "StolenVehicleAlert",
]);

function parseArgs(argv) {
  const args = { confirm: false, category: "FamilySosAlert" };
  for (const entry of argv) {
    if (entry === "--confirm") args.confirm = true;
    else if (entry.startsWith("--token=")) args.token = entry.slice("--token=".length).trim();
    else if (entry.startsWith("--title=")) args.title = entry.slice("--title=".length);
    else if (entry.startsWith("--body=")) args.body = entry.slice("--body=".length);
    else if (entry.startsWith("--category=")) args.category = entry.slice("--category=".length);
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
  if (env.FCM_PROJECT_ID === "the-eye-2pd-d0217" && process.env.ALLOW_PROD_WATCH_FCM_TEST !== "true") {
    throw new Error("Refusing production FCM watch test. Set ALLOW_PROD_WATCH_FCM_TEST=true to override.");
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.token) {
    console.error("Usage: pnpm run fcm:test-watch -- --token=<fcm-registration-token> --confirm");
    process.exit(1);
  }
  if (!args.confirm) {
    console.error("Refusing to send without --confirm.");
    process.exit(1);
  }
  if (!WATCH_CATEGORIES.has(args.category)) {
    console.error(`Unsupported watch category: ${args.category}`);
    process.exit(1);
  }

  const repoRoot = path.join(__dirname, "..");
  const env = loadProductionEnv(repoRoot);
  assertDevOnly(env);

  const projectId = env.FCM_PROJECT_ID.trim();
  const clientEmail = env.FCM_CLIENT_EMAIL.trim();
  const privateKey = normalizePrivateKey(env.FCM_PRIVATE_KEY);
  const title = args.title ?? "THE EYE watch alert test";
  const body = args.body ?? "Single-device watch push verification";

  console.log(
    JSON.stringify(
      {
        phase: "submitted",
        projectId,
        category: args.category,
        tokenSuffix: maskToken(args.token),
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
          type: args.category,
          priority: "High",
          channel: "watch_push",
        },
        android: { priority: "high" },
      },
    }),
  });

  const payload = await response.json();
  console.log(
    JSON.stringify(
      {
        phase: response.ok ? "provider_accepted" : "failed",
        projectId,
        category: args.category,
        tokenSuffix: maskToken(args.token),
        providerMessageId: payload.name ?? null,
        error: payload.error?.message ?? (response.ok ? null : `HTTP ${response.status}`),
      },
      null,
      2,
    ),
  );

  if (!response.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
