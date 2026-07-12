#!/usr/bin/env node
/**
 * Verifies live FCM service-account credentials without printing secrets.
 */
const { createSign } = require("crypto");
const path = require("path");
const { loadProductionEnv } = require("./firebase/guard-production.cjs");

function normalizePrivateKey(value) {
  return String(value ?? "").replace(/\\n/g, "\n").trim();
}

async function main() {
  const env = loadProductionEnv(path.join(__dirname, ".."));
  const projectId = String(env.FCM_PROJECT_ID ?? "").trim();
  const clientEmail = String(env.FCM_CLIENT_EMAIL ?? "").trim();
  const privateKey = normalizePrivateKey(env.FCM_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("FCM credentials incomplete");
  }
  if (env.FCM_MODE !== "real") throw new Error("FCM_MODE must be real");
  if (env.FCM_ALLOW_SIMULATION === "true" || env.FCM_SIMULATION_MODE === "true") {
    throw new Error("FCM simulation flags must be false");
  }

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

  console.log(
    JSON.stringify(
      {
        firebaseInitialization: "PASS",
        projectId,
        credentialMethod: "service-account-jwt",
        fcmMode: env.FCM_MODE,
        oauthAccepted: true,
        tokenType: body.token_type ?? "Bearer",
        expiresInSeconds: body.expires_in ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        firebaseInitialization: "FAIL",
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
