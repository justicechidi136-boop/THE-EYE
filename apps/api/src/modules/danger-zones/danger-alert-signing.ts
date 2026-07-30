import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from "crypto";
import type { DangerZoneAlertPayloadV1 } from "@the-eye/shared";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export type DangerAlertSigningConfig = {
  privateKeyPem: string;
  keyId: string;
};

export function resolveDangerAlertSigningConfig(
  config: Record<string, unknown>,
): DangerAlertSigningConfig | null {
  const privateKeyRaw = String(config.DANGER_ALERT_SIGNING_PRIVATE_KEY ?? "").trim();
  if (!privateKeyRaw) return null;
  const privateKeyPem = privateKeyRaw.includes("BEGIN")
    ? privateKeyRaw
    : `${["-----BEGIN", "PRIVATE KEY-----"].join(" ")}\n${privateKeyRaw}\n${["-----END", "PRIVATE KEY-----"].join(" ")}`;
  const keyId = String(config.DANGER_ALERT_SIGNING_KEY_ID ?? "staging-v1").trim();
  return { privateKeyPem, keyId };
}

/** Deterministic canonical message for Ed25519 signing (field order fixed). */
export function buildDangerAlertSigningMessage(
  payload: Pick<
    DangerZoneAlertPayloadV1,
    | "schemaVersion"
    | "alertId"
    | "version"
    | "sequence"
    | "state"
    | "alertCode"
    | "priority"
    | "issuedAt"
    | "expiresAt"
    | "zoneId"
    | "distanceMeters"
    | "areaName"
  >,
): string {
  return JSON.stringify({
    schemaVersion: payload.schemaVersion,
    alertId: payload.alertId,
    version: payload.version,
    sequence: payload.sequence,
    state: payload.state,
    alertCode: payload.alertCode,
    priority: payload.priority,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt ?? "",
    zoneId: payload.zoneId,
    distanceMeters: payload.distanceMeters ?? null,
    areaName: payload.areaName ?? "",
  });
}

export function signDangerAlertPayload(
  payload: DangerZoneAlertPayloadV1,
  signing: DangerAlertSigningConfig,
): DangerZoneAlertPayloadV1 {
  const signedAt = new Date().toISOString();
  const message = buildDangerAlertSigningMessage(payload);
  const privateKey = createPrivateKey(signing.privateKeyPem);
  const signatureBytes = sign(null, Buffer.from(message, "utf8"), privateKey);
  return {
    ...payload,
    signature: {
      keyId: signing.keyId,
      signature: signatureBytes.toString("base64url"),
      signedAt,
    },
  };
}

export function verifyDangerAlertPayload(
  payload: DangerZoneAlertPayloadV1,
  publicKeyPem: string,
  now: Date = new Date(),
): { valid: boolean; reason?: string } {
  if (!payload.signature) return { valid: false, reason: "missing_signature" };
  if (payload.schemaVersion !== 1) return { valid: false, reason: "unsupported_schema" };

  const issuedAt = Date.parse(payload.issuedAt);
  if (!Number.isFinite(issuedAt)) return { valid: false, reason: "invalid_issued_at" };
  if (issuedAt > now.getTime() + MAX_CLOCK_SKEW_MS) return { valid: false, reason: "issued_at_future" };

  if (payload.expiresAt) {
    const expiresAt = Date.parse(payload.expiresAt);
    if (Number.isFinite(expiresAt) && expiresAt < now.getTime()) {
      return { valid: false, reason: "expired" };
    }
  }

  const message = buildDangerAlertSigningMessage(payload);
  const publicKey = createPublicKey(publicKeyPem);
  const ok = verify(
    null,
    Buffer.from(message, "utf8"),
    publicKey,
    Buffer.from(payload.signature.signature, "base64url"),
  );
  return ok ? { valid: true } : { valid: false, reason: "invalid_signature" };
}

export function exportPublicKeyPem(privateKeyPem: string): string {
  const privateKey = createPrivateKey(privateKeyPem);
  const publicKey: KeyObject = createPublicKey(privateKey);
  return publicKey.export({ type: "spki", format: "pem" }).toString();
}
