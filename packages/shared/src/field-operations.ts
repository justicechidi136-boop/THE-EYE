import { AdminRoleName } from "./enums";

/** Operational roles exposed in the field tablet product surface. */
export enum FieldOperationalRole {
  PatrolOfficer = "PatrolOfficer",
  PatrolTeamLead = "PatrolTeamLead",
  CheckpointOfficer = "CheckpointOfficer",
  CheckpointCommander = "CheckpointCommander",
  Dispatcher = "Dispatcher",
  AgencySupervisor = "AgencySupervisor",
  EmergencyResponder = "EmergencyResponder",
  DroneOperator = "DroneOperator",
  FieldReadOnlyObserver = "FieldReadOnlyObserver",
}

export enum FieldDeviceRegistrationStatus {
  PendingApproval = "PendingApproval",
  Active = "Active",
  Suspended = "Suspended",
  Lost = "Lost",
  Revoked = "Revoked",
  Retired = "Retired",
}

export const FIELD_ERROR_CODES = {
  DEVICE_REGISTRATION_REQUIRED: "FIELD-DEVICE-001",
  DEVICE_APPROVAL_PENDING: "FIELD-DEVICE-002",
  DEVICE_SUSPENDED: "FIELD-DEVICE-003",
  DEVICE_MARKED_LOST: "FIELD-DEVICE-004",
  DEVICE_REVOKED: "FIELD-DEVICE-005",
  DEVICE_REPAIR_REQUIRED: "FIELD-DEVICE-006",
  ROLE_NOT_AUTHORIZED: "FIELD-AUTH-001",
  JURISDICTION_MISMATCH: "FIELD-AUTH-002",
  DEVICE_SIGNATURE_INVALID: "FIELD-AUTH-003",
  SESSION_EXPIRED: "FIELD-AUTH-004",
} as const;

export type FieldErrorCode = (typeof FIELD_ERROR_CODES)[keyof typeof FIELD_ERROR_CODES];

/** Maps field operational roles to existing admin roles (no duplicate DB roles). */
export const fieldOperationalRoleToAdminRole: Record<FieldOperationalRole, AdminRoleName> = {
  [FieldOperationalRole.PatrolOfficer]: AdminRoleName.PoliceSecurityOfficer,
  [FieldOperationalRole.PatrolTeamLead]: AdminRoleName.AgencyAdmin,
  [FieldOperationalRole.CheckpointOfficer]: AdminRoleName.PoliceSecurityOfficer,
  [FieldOperationalRole.CheckpointCommander]: AdminRoleName.AgencyAdmin,
  [FieldOperationalRole.Dispatcher]: AdminRoleName.CallCenterAgent,
  [FieldOperationalRole.AgencySupervisor]: AdminRoleName.AgencyAdmin,
  [FieldOperationalRole.EmergencyResponder]: AdminRoleName.PoliceSecurityOfficer,
  [FieldOperationalRole.DroneOperator]: AdminRoleName.DroneOperator,
  [FieldOperationalRole.FieldReadOnlyObserver]: AdminRoleName.ReadOnlyObserver,
};

const FIELD_ELIGIBLE_ADMIN_ROLES = new Set<string>([
  AdminRoleName.PoliceSecurityOfficer,
  AdminRoleName.AgencyAdmin,
  AdminRoleName.CallCenterAgent,
  AdminRoleName.StateAdmin,
  AdminRoleName.LgaAdmin,
  AdminRoleName.CountryAdmin,
  AdminRoleName.DroneOperator,
  AdminRoleName.DroneCommander,
  AdminRoleName.ReadOnlyObserver,
  AdminRoleName.OversightAuditor,
]);

export function resolveFieldOperationalRole(adminRoleName: string): FieldOperationalRole | null {
  const entry = Object.entries(fieldOperationalRoleToAdminRole).find(([, adminRole]) => adminRole === adminRoleName);
  return entry ? (entry[0] as FieldOperationalRole) : null;
}

export function isFieldEligibleAdminRole(adminRoleName: string): boolean {
  if (adminRoleName === AdminRoleName.SuperAdmin) return false;
  return FIELD_ELIGIBLE_ADMIN_ROLES.has(adminRoleName);
}

export function canApproveFieldDevices(adminRoleName: string): boolean {
  return [
    AdminRoleName.SuperAdmin,
    AdminRoleName.AgencyAdmin,
    AdminRoleName.StateAdmin,
    AdminRoleName.LgaAdmin,
    AdminRoleName.CountryAdmin,
  ].includes(adminRoleName as AdminRoleName);
}
