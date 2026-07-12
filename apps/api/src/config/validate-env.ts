import {
  assertProductionFirebaseGuard,
  assertStagingFirebaseGuard,
  resolveAppEnvironment,
} from "../common/auth/firebase-environment";
import {
  DEVELOPMENT_FIREBASE_PROJECT_ID,
  FIREBASE_PROJECT_IDS,
  isKnownFirebaseProjectId,
  PRODUCTION_FIREBASE_PROJECT_ID,
  STAGING_FIREBASE_PROJECT_ID,
} from "../common/auth/firebase-project";

const productionSecrets = [
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "LIVE_LOCATION_LINK_SECRET",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "S3_SECRET_KEY",
  "REDIS_PASSWORD",
] as const;

function validateFirebaseProjectEnv(config: Record<string, unknown>) {
  const firebaseProjectId = String(config.FIREBASE_PROJECT_ID ?? "").trim();
  const fcmProjectId = String(config.FCM_PROJECT_ID ?? "").trim();

  if (firebaseProjectId && !isKnownFirebaseProjectId(firebaseProjectId)) {
    throw new Error(`FIREBASE_PROJECT_ID must be one of: ${FIREBASE_PROJECT_IDS.join(", ")}`);
  }

  if (firebaseProjectId && fcmProjectId && firebaseProjectId !== fcmProjectId) {
    throw new Error("FIREBASE_PROJECT_ID must match FCM_PROJECT_ID for the same Firebase environment");
  }
}

export function validateEnvironment(config: Record<string, unknown>) {
  validateFirebaseProjectEnv(config);

  const appEnvironment = resolveAppEnvironment(config);
  if (appEnvironment === "staging") {
    assertStagingFirebaseGuard(config);
  }
  if (appEnvironment === "production") {
    assertProductionFirebaseGuard(config);
  }

  if (appEnvironment === "production") {
    if (config.THE_EYE_DISABLE_REDIS === "1" || config.THE_EYE_DISABLE_REDIS === 1) {
      throw new Error("THE_EYE_DISABLE_REDIS must be 0 in production");
    }
  }

  if (config.NODE_ENV !== "production") return config;

  for (const key of productionSecrets) {
    const value = config[key];
    if (typeof value !== "string" || value.length < 24 || value.startsWith("change_me") || value.startsWith("dev")) {
      throw new Error(`${key} must be set to a production secret of at least 24 characters`);
    }
  }

  if (typeof config.CORS_ORIGINS !== "string" || !config.CORS_ORIGINS.trim()) {
    throw new Error("CORS_ORIGINS must list trusted admin origins in production");
  }
  if (typeof config.GOOGLE_OAUTH_CLIENT_ID !== "string" || !config.GOOGLE_OAUTH_CLIENT_ID.trim()) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID is required in production");
  }
  for (const key of ["DATABASE_URL", "DATABASE_DIRECT_URL", "S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY", "REDIS_HOST"]) {
    if (typeof config[key] !== "string" || !String(config[key]).trim()) throw new Error(`${key} is required in production`);
  }
  const runtimeDb = String(config.DATABASE_URL ?? "");
  if (/[?&]pgbouncer=true\b/.test(runtimeDb) && runtimeDb === String(config.DATABASE_DIRECT_URL ?? "")) {
    throw new Error("DATABASE_DIRECT_URL must point to direct Postgres when DATABASE_URL uses PgBouncer");
  }
  if (config.ALLOW_DEV_AUTH_CODES === "true" || config.ALLOW_DEV_AUTH_CODES === true) {
    throw new Error("ALLOW_DEV_AUTH_CODES must be false in production");
  }
  if (typeof config.METRICS_BEARER_TOKEN !== "string" || String(config.METRICS_BEARER_TOKEN).length < 24) {
    throw new Error("METRICS_BEARER_TOKEN must be set to a production secret of at least 24 characters");
  }
  return config;
}

export {
  DEVELOPMENT_FIREBASE_PROJECT_ID,
  PRODUCTION_FIREBASE_PROJECT_ID,
  STAGING_FIREBASE_PROJECT_ID,
};
