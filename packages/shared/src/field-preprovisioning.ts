/** How a FieldDevice record came into existence. */
export enum FieldProvisioningMode {
  SelfRegistration = "SelfRegistration",
  PreProvisioned = "PreProvisioned",
}

/**
 * Lifecycle of a pre-provisioned device, tracked independently of `registrationStatus`
 * (Active/Suspended/Lost/Revoked/Retired), which continues to describe whether a bound
 * device may authenticate. `preProvisionStatus` only describes provisioning progress.
 */
export enum FieldPreProvisionStatus {
  Draft = "Draft",
  AwaitingPairing = "AwaitingPairing",
  Paired = "Paired",
  AwaitingFinalApproval = "AwaitingFinalApproval",
  Active = "Active",
  Cancelled = "Cancelled",
  Expired = "Expired",
}

export enum FieldPairingTokenStatus {
  Issued = "Issued",
  Claimed = "Claimed",
  Completed = "Completed",
  Expired = "Expired",
  Revoked = "Revoked",
  Failed = "Failed",
}

/** What happens automatically when a pairing completes. */
export enum FieldActivationPolicy {
  AutoActivateOnPairing = "AutoActivateOnPairing",
  RequireSupervisorFinalApproval = "RequireSupervisorFinalApproval",
}

export const FIELD_PAIRING_ERROR_CODES = {
  TOKEN_INVALID: "FIELD-PAIR-001",
  TOKEN_EXPIRED: "FIELD-PAIR-002",
  TOKEN_ALREADY_USED: "FIELD-PAIR-003",
  RATE_LIMITED: "FIELD-PAIR-004",
  DEVICE_ALREADY_BOUND: "FIELD-PAIR-005",
} as const;

export type FieldPairingErrorCode = (typeof FIELD_PAIRING_ERROR_CODES)[keyof typeof FIELD_PAIRING_ERROR_CODES];

const SHORT_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const FIELD_PAIRING_SHORT_CODE_ALPHABET = SHORT_CODE_ALPHABET;

/** EYE-XXXX-XXXX using a Crockford-like alphabet (no 0/O/1/I/L ambiguity). */
export const FIELD_PAIRING_SHORT_CODE_PATTERN = /^EYE-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/;

export function formatFieldPairingShortCode(rawCharacters: string): string {
  const cleaned = rawCharacters.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return `EYE-${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
}

export function normalizeFieldPairingShortCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidFieldPairingShortCode(value: string): boolean {
  return FIELD_PAIRING_SHORT_CODE_PATTERN.test(normalizeFieldPairingShortCode(value));
}
