import type { AdminSession } from "./types/admin-views";

export function canManageSmartwatches(session: AdminSession | null | undefined) {
  return Boolean(session?.permissions?.includes("user:manage"));
}

export function canViewSmartwatchSos(session: AdminSession | null | undefined) {
  return Boolean(session?.permissions?.includes("incident:read"));
}

export function canPublishSmartwatchFirmware(session: AdminSession | null | undefined) {
  return canManageSmartwatches(session);
}
