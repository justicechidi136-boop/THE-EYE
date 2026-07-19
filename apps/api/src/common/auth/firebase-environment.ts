import {
  DEVELOPMENT_FIREBASE_PROJECT_ID,
  PRODUCTION_FIREBASE_PROJECT_ID,
  STAGING_FIREBASE_PROJECT_ID,
} from "./firebase-project";
import { hasFcmCredentialSource } from "./firebase-credentials";

export type AppEnvironment = "development" | "staging" | "production";

const APP_ENVIRONMENTS = new Set<AppEnvironment>(["development", "staging", "production"]);

export function isAppEnvironment(value: string): value is AppEnvironment {
  return APP_ENVIRONMENTS.has(value as AppEnvironment);
}

export function appEnvironmentFromProjectId(projectId: string): AppEnvironment | null {
  if (projectId === PRODUCTION_FIREBASE_PROJECT_ID) return "production";
  if (projectId === STAGING_FIREBASE_PROJECT_ID) return "staging";
  if (projectId === DEVELOPMENT_FIREBASE_PROJECT_ID) return "development";
  return null;
}

export function resolveAppEnvironment(config: Record<string, unknown>): AppEnvironment {
  const explicit = String(config.THE_EYE_APP_ENV ?? "").trim().toLowerCase();
  if (explicit === "staging" || explicit === "stg") return "staging";
  if (explicit === "production" || explicit === "prod") return "production";
  if (explicit === "development" || explicit === "dev" || explicit === "local") return "development";

  const fcmProjectId = String(config.FCM_PROJECT_ID ?? "").trim();
  const fromFcm = appEnvironmentFromProjectId(fcmProjectId);
  if (fromFcm) return fromFcm;

  const firebaseProjectId = String(config.FIREBASE_PROJECT_ID ?? "").trim();
  const fromFirebase = appEnvironmentFromProjectId(firebaseProjectId);
  if (fromFirebase) return fromFirebase;

  if (config.NODE_ENV === "production") return "production";
  return "development";
}

function readProjectIds(config: Record<string, unknown>) {
  return {
    firebaseProjectId: String(config.FIREBASE_PROJECT_ID ?? "").trim(),
    fcmProjectId: String(config.FCM_PROJECT_ID ?? "").trim(),
  };
}

function simulationEnabled(config: Record<string, unknown>) {
  return (
    config.FCM_ALLOW_SIMULATION === "true" ||
    config.FCM_ALLOW_SIMULATION === true ||
    config.FCM_SIMULATION_MODE === "true" ||
    config.FCM_SIMULATION_MODE === true ||
    (typeof config.FCM_MODE === "string" && config.FCM_MODE.trim() !== "" && config.FCM_MODE.trim() !== "real")
  );
}

export function assertProductionFirebaseGuard(config: Record<string, unknown>) {
  const { firebaseProjectId, fcmProjectId } = readProjectIds(config);

  if (firebaseProjectId && firebaseProjectId !== PRODUCTION_FIREBASE_PROJECT_ID) {
    throw new Error(`FIREBASE_PROJECT_ID must be ${PRODUCTION_FIREBASE_PROJECT_ID} in production`);
  }
  if (fcmProjectId === STAGING_FIREBASE_PROJECT_ID || fcmProjectId === DEVELOPMENT_FIREBASE_PROJECT_ID) {
    throw new Error("FCM_PROJECT_ID must not use a staging or development Firebase project in production");
  }
  if (firebaseProjectId === STAGING_FIREBASE_PROJECT_ID || firebaseProjectId === DEVELOPMENT_FIREBASE_PROJECT_ID) {
    throw new Error("FIREBASE_PROJECT_ID must not use a staging or development Firebase project in production");
  }
  if (fcmProjectId && fcmProjectId !== PRODUCTION_FIREBASE_PROJECT_ID) {
    throw new Error(`FCM_PROJECT_ID must be ${PRODUCTION_FIREBASE_PROJECT_ID} in production`);
  }
  if (!fcmProjectId) {
    throw new Error("FCM_PROJECT_ID is required in production");
  }
  if (!hasFcmCredentialSource(config)) {
    throw new Error("FCM credentials are required in production (FCM_CLIENT_EMAIL + FCM_PRIVATE_KEY, FCM_SERVICE_ACCOUNT_JSON, or GOOGLE_APPLICATION_CREDENTIALS)");
  }
  if (simulationEnabled(config)) {
    throw new Error("FCM simulation must be disabled in production");
  }
}

export function assertStagingFirebaseGuard(config: Record<string, unknown>) {
  const { firebaseProjectId, fcmProjectId } = readProjectIds(config);

  if (fcmProjectId === PRODUCTION_FIREBASE_PROJECT_ID) {
    throw new Error("FCM_PROJECT_ID must not use the production Firebase project in staging");
  }
  if (firebaseProjectId === PRODUCTION_FIREBASE_PROJECT_ID) {
    throw new Error("FIREBASE_PROJECT_ID must not use the production Firebase project in staging");
  }
  if (!fcmProjectId) {
    throw new Error(`FCM_PROJECT_ID is required in staging (must be ${STAGING_FIREBASE_PROJECT_ID})`);
  }
  if (!firebaseProjectId) {
    throw new Error(`FIREBASE_PROJECT_ID is required in staging (must be ${STAGING_FIREBASE_PROJECT_ID})`);
  }
  if (fcmProjectId !== STAGING_FIREBASE_PROJECT_ID) {
    throw new Error(`FCM_PROJECT_ID must be ${STAGING_FIREBASE_PROJECT_ID} in staging`);
  }
  if (firebaseProjectId !== STAGING_FIREBASE_PROJECT_ID) {
    throw new Error(`FIREBASE_PROJECT_ID must be ${STAGING_FIREBASE_PROJECT_ID} in staging`);
  }
}

export function buildFirebaseAdminProbe(config: Record<string, unknown>, runtime: { mode: "real" | "simulated"; projectId?: string; reason?: string }) {
  const appEnvironment = resolveAppEnvironment(config);
  const configuredProjectId =
    runtime.mode === "real"
      ? runtime.projectId ?? String(config.FCM_PROJECT_ID ?? "").trim()
      : String(config.FCM_PROJECT_ID ?? "").trim() || null;

  return {
    appEnvironment,
    projectId: configuredProjectId,
    configured: runtime.mode === "real",
    simulation: runtime.mode === "simulated",
    ...(runtime.mode === "simulated" && runtime.reason ? { simulationReason: runtime.reason } : {}),
  };
}
