import type { ConfigService } from "@nestjs/config";
import { resolveFcmCredentials } from "../../../common/auth/firebase-credentials";
import {
  PRODUCTION_FIREBASE_PROJECT_ID,
  STAGING_FIREBASE_PROJECT_ID,
} from "../../../common/auth/firebase-project";
import { resolveAppEnvironment } from "../../../common/auth/firebase-environment";

export { PRODUCTION_FIREBASE_PROJECT_ID as PRODUCTION_FCM_PROJECT_ID };
export { STAGING_FIREBASE_PROJECT_ID as STAGING_FCM_PROJECT_ID };
export { normalizeFcmPrivateKey } from "../../../common/auth/firebase-credentials";

export type FcmRuntimeMode = "real" | "simulated";

export type FcmRuntimeConfig =
  | {
      mode: "real";
      projectId: string;
      clientEmail: string;
      privateKey: string;
    }
  | {
      mode: "simulated";
      reason: string;
    };

export function isFcmSimulationFlagEnabled(value?: string | null) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

export function isProductionLikeFcmRuntime(config: ConfigService) {
  const appEnvironment = resolveAppEnvironment({
    THE_EYE_APP_ENV: config.get<string>("THE_EYE_APP_ENV"),
    FCM_PROJECT_ID: config.get<string>("FCM_PROJECT_ID"),
    FIREBASE_PROJECT_ID: config.get<string>("FIREBASE_PROJECT_ID"),
    NODE_ENV: process.env.NODE_ENV,
  });
  if (appEnvironment === "production" || appEnvironment === "staging") return true;
  const mode = config.get<string>("FCM_MODE")?.trim();
  return mode === "real";
}

export function resolveFcmRuntime(config: ConfigService): FcmRuntimeConfig {
  const fcmMode = config.get<string>("FCM_MODE")?.trim() ?? "";
  const allowSimulation = config.get<string>("FCM_ALLOW_SIMULATION");
  const simulationMode = config.get<string>("FCM_SIMULATION_MODE");
  const credentials = resolveFcmCredentials(config);

  const simulationFlags =
    isFcmSimulationFlagEnabled(allowSimulation) ||
    isFcmSimulationFlagEnabled(simulationMode) ||
    (Boolean(fcmMode) && fcmMode !== "real");

  if (isProductionLikeFcmRuntime(config) && (!credentials || simulationFlags)) {
    const reasons = [];
    if (!credentials) reasons.push("FCM credentials are incomplete");
    if (simulationFlags) reasons.push("FCM simulation flags are enabled");
    return { mode: "simulated", reason: `FCM blocked in production-like runtime: ${reasons.join("; ")}` };
  }

  if (!credentials) {
    return { mode: "simulated", reason: "FCM credentials are not configured" };
  }

  if (simulationFlags) {
    return { mode: "simulated", reason: "FCM simulation flags are enabled" };
  }

  const projectId = credentials.projectId || config.get<string>("FCM_PROJECT_ID")?.trim() || "";
  if (!projectId) {
    return { mode: "simulated", reason: "FCM project ID is not configured" };
  }

  return {
    mode: "real",
    projectId,
    clientEmail: credentials.clientEmail,
    privateKey: credentials.privateKey,
  };
}

export function assertFcmRuntimeAllowed(config: ConfigService) {
  const runtime = resolveFcmRuntime(config);
  if (runtime.mode === "simulated" && isProductionLikeFcmRuntime(config)) {
    throw new Error(runtime.reason);
  }
  return runtime;
}
