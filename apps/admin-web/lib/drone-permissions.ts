import type { AdminSession } from "./types/admin-views";

export function canViewDroneSurveillance(session: AdminSession | null | undefined) {
  return Boolean(session?.permissions?.includes("drone:read"));
}

export function canManageDroneFleet(session: AdminSession | null | undefined) {
  return Boolean(session?.permissions?.includes("drone:manage"));
}

export function canCreateDroneMission(session: AdminSession | null | undefined) {
  return Boolean(session?.permissions?.includes("drone:mission:create"));
}

export function canCommandDroneMission(session: AdminSession | null | undefined) {
  return Boolean(session?.permissions?.includes("drone:mission:command"));
}

export function canViewDroneEvidence(session: AdminSession | null | undefined) {
  return Boolean(session?.permissions?.includes("drone:evidence:read"));
}
