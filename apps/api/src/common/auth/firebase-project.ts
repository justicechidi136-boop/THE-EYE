import { resolveAppEnvironment } from "./firebase-environment";
import { resolveFcmCredentials } from "./firebase-credentials";

export const DEVELOPMENT_FIREBASE_PROJECT_ID = "the-eye-29cff";
export const STAGING_FIREBASE_PROJECT_ID = "the-eye-2stg";
export const PRODUCTION_FIREBASE_PROJECT_ID = "the-eye-2pd-d0217";

export const FIREBASE_PROJECT_IDS = [
  DEVELOPMENT_FIREBASE_PROJECT_ID,
  STAGING_FIREBASE_PROJECT_ID,
  PRODUCTION_FIREBASE_PROJECT_ID,
] as const;

export type FirebaseProjectId = (typeof FIREBASE_PROJECT_IDS)[number];

type ConfigReader = {
  get: (key: string, fallback?: string) => string | undefined;
};

export function isKnownFirebaseProjectId(value: string): value is FirebaseProjectId {
  return (FIREBASE_PROJECT_IDS as readonly string[]).includes(value);
}

export function resolveFirebaseProjectId(config: ConfigReader): FirebaseProjectId {
  const explicit = config.get("FIREBASE_PROJECT_ID")?.trim() ?? "";
  if (explicit) {
    if (!isKnownFirebaseProjectId(explicit)) {
      throw new Error(
        `FIREBASE_PROJECT_ID must be one of: ${FIREBASE_PROJECT_IDS.join(", ")} (got ${explicit})`,
      );
    }
    return explicit;
  }

  const fcmProjectId = config.get("FCM_PROJECT_ID")?.trim() ?? "";
  if (isKnownFirebaseProjectId(fcmProjectId)) return fcmProjectId;

  const credentials = resolveFcmCredentials(config as Record<string, unknown>);
  const credentialProjectId = credentials?.projectId?.trim() ?? "";
  if (isKnownFirebaseProjectId(credentialProjectId)) return credentialProjectId;

  const appEnvironment = resolveAppEnvironment({
    THE_EYE_APP_ENV: config.get("THE_EYE_APP_ENV"),
    FCM_PROJECT_ID: fcmProjectId,
    FIREBASE_PROJECT_ID: explicit,
    NODE_ENV: process.env.NODE_ENV,
  });
  if (appEnvironment === "staging") return STAGING_FIREBASE_PROJECT_ID;
  if (appEnvironment === "production") return PRODUCTION_FIREBASE_PROJECT_ID;

  return DEVELOPMENT_FIREBASE_PROJECT_ID;
}

export function assertFirebaseProjectConfigured(config: ConfigReader): FirebaseProjectId {
  return resolveFirebaseProjectId(config);
}
