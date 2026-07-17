/**
 * Client-safe public env accessors for admin-web UI.
 * Keep this module free of localhost/dev fallback strings so staging bundles
 * pass artifact validation.
 */

import type { AppEnv } from "./public-env";

function resolveAppEnvLabel(appEnv: AppEnv): string {
  switch (appEnv) {
    case "production":
      return "Production";
    case "staging":
      return "Staging";
    case "development":
      return "Development";
    default:
      return "Local";
  }
}

function resolveAppEnvBadgeTone(appEnv: AppEnv): "danger" | "warning" | "success" | "info" | "neutral" {
  switch (appEnv) {
    case "production":
      return "success";
    case "staging":
      return "warning";
    case "development":
      return "info";
    default:
      return "neutral";
  }
}

const configuredAppEnv = process.env.NEXT_PUBLIC_APP_ENV?.trim();
const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

export const publicAppEnv = (
  configuredAppEnv === "production" ||
  configuredAppEnv === "staging" ||
  configuredAppEnv === "development" ||
  configuredAppEnv === "local"
    ? configuredAppEnv
    : "local"
) as AppEnv;

export const publicApiBaseUrl = (configuredApiBaseUrl || "/v1").replace(/\/$/, "");
export const publicAppEnvLabel = resolveAppEnvLabel(publicAppEnv);
export const publicAppEnvBadgeTone = resolveAppEnvBadgeTone(publicAppEnv);
