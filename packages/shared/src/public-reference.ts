/**
 * Deterministic citizen-facing reference derived from internal UUID + submitted time.
 * Immutable for the lifetime of the incident; not used for authorization.
 */
export function buildIncidentPublicReference(input: {
  incidentId: string;
  submittedAt: Date | string;
}): string {
  const submitted =
    input.submittedAt instanceof Date ? input.submittedAt : new Date(input.submittedAt);
  if (Number.isNaN(submitted.getTime())) {
    throw new Error("submittedAt must be a valid date");
  }
  const compact = input.incidentId.replace(/-/g, "").toUpperCase();
  const suffix = compact.slice(-4) || "0000";
  const yy = String(submitted.getUTCFullYear()).slice(-2);
  const mm = String(submitted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(submitted.getUTCDate()).padStart(2, "0");
  return `EYE-${yy}${mm}${dd}-${suffix}`;
}

export function buildBroadcastPublicReference(input: {
  broadcastId: string;
  createdAt: Date | string;
}): string {
  const created = input.createdAt instanceof Date ? input.createdAt : new Date(input.createdAt);
  if (Number.isNaN(created.getTime())) {
    throw new Error("createdAt must be a valid date");
  }
  const compact = input.broadcastId.replace(/-/g, "").toUpperCase();
  const suffix = compact.slice(-4) || "0000";
  const yy = String(created.getUTCFullYear()).slice(-2);
  const mm = String(created.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(created.getUTCDate()).padStart(2, "0");
  return `EYE-B-${yy}${mm}${dd}-${suffix}`;
}
