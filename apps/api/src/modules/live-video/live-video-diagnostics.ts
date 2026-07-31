import { createHash } from "crypto";

export type LiveVideoConnectionDiagnostics = {
  serverUrl: string;
  roomName: string;
  participantIdentity: string;
  tokenPresent: boolean;
  tokenLength: number;
  tokenExpiresAt: string | null;
  tokenFingerprint: string | null;
  apiKeyFingerprint: string | null;
};

export function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}

export function apiKeyFingerprint(apiKey: string): string {
  const trimmed = String(apiKey ?? "").trim();
  if (!trimmed) return "";
  return createHash("sha256").update(trimmed).digest("hex").slice(0, 8);
}

export function decodeJwtExpiryIso(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      exp?: number;
    };
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return null;
    return new Date(payload.exp * 1000).toISOString();
  } catch {
    return null;
  }
}

export function buildLiveVideoConnectionDiagnostics(input: {
  serverUrl: string;
  roomName: string;
  participantIdentity: string;
  token: string;
  apiKey: string;
}): LiveVideoConnectionDiagnostics {
  const token = String(input.token ?? "").trim();
  return {
    serverUrl: input.serverUrl,
    roomName: input.roomName,
    participantIdentity: input.participantIdentity,
    tokenPresent: token.length > 0,
    tokenLength: token.length,
    tokenExpiresAt: token ? decodeJwtExpiryIso(token) : null,
    tokenFingerprint: token ? tokenFingerprint(token) : null,
    apiKeyFingerprint: apiKeyFingerprint(input.apiKey),
  };
}
