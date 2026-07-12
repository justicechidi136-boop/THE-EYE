import { readFileSync } from "fs";
import type { ConfigService } from "@nestjs/config";

export function normalizeFcmPrivateKey(value?: string | null) {
  return String(value ?? "")
    .replace(/\\n/g, "\n")
    .trim();
}

type ServiceAccountJson = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

export type ResolvedFcmCredentials = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  source: "inline" | "service-account-json" | "google-application-credentials";
};

function readConfigValue(config: ConfigService | Record<string, unknown>, key: string): string {
  if ("get" in config && typeof config.get === "function") {
    return String(config.get(key) ?? "").trim();
  }
  return String((config as Record<string, unknown>)[key] ?? "").trim();
}

export function parseFcmServiceAccountJson(raw?: string | null): ServiceAccountJson | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as ServiceAccountJson;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function hasFcmCredentialSource(config: Record<string, unknown>): boolean {
  const clientEmail = String(config.FCM_CLIENT_EMAIL ?? "").trim();
  const privateKey = String(config.FCM_PRIVATE_KEY ?? "").trim();
  if (clientEmail && privateKey) return true;

  const json = parseFcmServiceAccountJson(String(config.FCM_SERVICE_ACCOUNT_JSON ?? ""));
  if (json?.client_email && json?.private_key) return true;

  const credentialsPath = String(config.GOOGLE_APPLICATION_CREDENTIALS ?? "").trim();
  if (credentialsPath) return true;

  return false;
}

function loadServiceAccountFromPath(path: string): ServiceAccountJson | null {
  try {
    const raw = readFileSync(path, "utf8");
    return parseFcmServiceAccountJson(raw);
  } catch {
    return null;
  }
}

export function resolveFcmCredentials(config: ConfigService | Record<string, unknown>): ResolvedFcmCredentials | null {
  const inlineProjectId = readConfigValue(config, "FCM_PROJECT_ID");
  const inlineClientEmail = readConfigValue(config, "FCM_CLIENT_EMAIL");
  const inlinePrivateKey = normalizeFcmPrivateKey(readConfigValue(config, "FCM_PRIVATE_KEY"));
  if (inlineProjectId && inlineClientEmail && inlinePrivateKey) {
    return {
      projectId: inlineProjectId,
      clientEmail: inlineClientEmail,
      privateKey: inlinePrivateKey,
      source: "inline",
    };
  }

  const jsonAccount = parseFcmServiceAccountJson(readConfigValue(config, "FCM_SERVICE_ACCOUNT_JSON"));
  if (jsonAccount?.client_email && jsonAccount.private_key) {
    return {
      projectId: jsonAccount.project_id?.trim() || inlineProjectId,
      clientEmail: jsonAccount.client_email.trim(),
      privateKey: normalizeFcmPrivateKey(jsonAccount.private_key),
      source: "service-account-json",
    };
  }

  const credentialsPath = readConfigValue(config, "GOOGLE_APPLICATION_CREDENTIALS");
  if (credentialsPath) {
    const fileAccount = loadServiceAccountFromPath(credentialsPath);
    if (fileAccount?.client_email && fileAccount.private_key) {
      return {
        projectId: fileAccount.project_id?.trim() || inlineProjectId,
        clientEmail: fileAccount.client_email.trim(),
        privateKey: normalizeFcmPrivateKey(fileAccount.private_key),
        source: "google-application-credentials",
      };
    }
  }

  return null;
}
