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

export function canReadDroneOperators(session: AdminSession | null | undefined) {
  return Boolean(session?.permissions?.includes("drone:operator:read"));
}

export function canCreateDroneOperator(session: AdminSession | null | undefined) {
  return Boolean(session?.permissions?.includes("drone:operator:create"));
}

export function canUpdateDroneOperator(session: AdminSession | null | undefined) {
  return Boolean(session?.permissions?.includes("drone:operator:update"));
}

export function canVerifyDroneOperator(session: AdminSession | null | undefined) {
  return Boolean(session?.permissions?.includes("drone:operator:verify"));
}

export function canAssignDroneOperator(session: AdminSession | null | undefined) {
  return Boolean(session?.permissions?.includes("drone:operator:assign"));
}

export function canReadOperatorDocuments(session: AdminSession | null | undefined) {
  return Boolean(session?.permissions?.includes("drone:operator:documents:read"));
}

export function canReadOperatorSafety(session: AdminSession | null | undefined) {
  return Boolean(session?.permissions?.includes("drone:operator:safety:read"));
}

export function canReadOperatorAudit(session: AdminSession | null | undefined) {
  return Boolean(session?.permissions?.includes("drone:operator:audit:read"));
}
