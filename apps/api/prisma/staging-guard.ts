import {
  PRODUCTION_FIREBASE_PROJECT_ID,
  STAGING_FIREBASE_PROJECT_ID,
} from "../src/common/auth/firebase-project";

const PRODUCTION_DATABASE_PATTERNS = [
  /the-eye-2pd/i,
  /the_eye_prod/i,
  /the-eye-prod/i,
  /\/prod(?:uction)?[./_-]/i,
  /[./_-]prod(?:uction)?[./_-]/i,
  /\.prod\./i,
  /dbname=.*prod/i,
] as const;

export type StagingGuardEnv = Record<string, string | undefined>;

export function detectProductionIndicators(env: StagingGuardEnv = process.env): string[] {
  const indicators: string[] = [];

  const fcmProjectId = String(env.FCM_PROJECT_ID ?? "").trim();
  const firebaseProjectId = String(env.FIREBASE_PROJECT_ID ?? "").trim();
  const databaseUrl = String(env.DATABASE_URL ?? "").trim();
  const databaseDirectUrl = String(env.DATABASE_DIRECT_URL ?? "").trim();
  const nodeEnv = String(env.NODE_ENV ?? "").trim().toLowerCase();

  if (fcmProjectId === PRODUCTION_FIREBASE_PROJECT_ID) {
    indicators.push(`FCM_PROJECT_ID=${PRODUCTION_FIREBASE_PROJECT_ID}`);
  }
  if (firebaseProjectId === PRODUCTION_FIREBASE_PROJECT_ID) {
    indicators.push(`FIREBASE_PROJECT_ID=${PRODUCTION_FIREBASE_PROJECT_ID}`);
  }

  for (const url of [databaseUrl, databaseDirectUrl]) {
    if (!url) continue;
    for (const pattern of PRODUCTION_DATABASE_PATTERNS) {
      if (pattern.test(url)) {
        indicators.push(`DATABASE_URL matches production pattern ${pattern}`);
        break;
      }
    }
  }

  if (nodeEnv === "production") {
    const hasProdFirebase =
      fcmProjectId === PRODUCTION_FIREBASE_PROJECT_ID ||
      firebaseProjectId === PRODUCTION_FIREBASE_PROJECT_ID;
    const hasProdDatabase = [databaseUrl, databaseDirectUrl].some((url) =>
      PRODUCTION_DATABASE_PATTERNS.some((pattern) => pattern.test(url)),
    );
    if (hasProdFirebase || hasProdDatabase) {
      indicators.push("NODE_ENV=production with production Firebase or database configuration");
    }
  }

  return [...new Set(indicators)];
}

export function assertStagingOnlySeedAllowed(env: StagingGuardEnv = process.env): void {
  const appEnv = String(env.THE_EYE_APP_ENV ?? "").trim().toLowerCase();
  if (appEnv !== "staging" && appEnv !== "stg") {
    throw new Error(
      `Staging test account seed aborted: THE_EYE_APP_ENV must be "staging" (got "${appEnv || "(unset)"}"). ` +
        "These accounts must never be created outside staging.",
    );
  }

  const productionIndicators = detectProductionIndicators(env);
  if (productionIndicators.length > 0) {
    throw new Error(
      `Staging test account seed aborted: production indicators detected — ${productionIndicators.join("; ")}. ` +
        "Refusing to seed staging test accounts against a production target.",
    );
  }

  const fcmProjectId = String(env.FCM_PROJECT_ID ?? "").trim();
  const firebaseProjectId = String(env.FIREBASE_PROJECT_ID ?? "").trim();
  if (fcmProjectId && fcmProjectId !== STAGING_FIREBASE_PROJECT_ID) {
    throw new Error(
      `Staging test account seed aborted: FCM_PROJECT_ID must be ${STAGING_FIREBASE_PROJECT_ID} in staging (got "${fcmProjectId}").`,
    );
  }
  if (firebaseProjectId && firebaseProjectId !== STAGING_FIREBASE_PROJECT_ID) {
    throw new Error(
      `Staging test account seed aborted: FIREBASE_PROJECT_ID must be ${STAGING_FIREBASE_PROJECT_ID} in staging (got "${firebaseProjectId}").`,
    );
  }
}
