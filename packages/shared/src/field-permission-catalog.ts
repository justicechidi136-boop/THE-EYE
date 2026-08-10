import { AdminRoleName } from "./enums";
import type { Permission } from "./permissions";

/**
 * Field capability permissions that pre-date permission profiles. Kept separate from
 * the new granular capability set so callers can distinguish "device lifecycle" admin
 * permissions from "what the officer can do in the field" capability permissions.
 */
export const EXISTING_FIELD_PERMISSIONS: Permission[] = [
  "field:access",
  "field:device:register",
  "field:device:manage",
  "field:device:approve",
  "field:session:operate",
];

/** Granular field capability permissions introduced for permission profiles. */
export const NEW_FIELD_CAPABILITY_PERMISSIONS: Permission[] = [
  "field:assignment:view",
  "field:assignment:accept",
  "field:incident:view",
  "field:incident:update-status",
  "field:incident:create",
  "field:communication:send",
  "field:evidence:add",
  "field:bolo:view",
  "field:sighting:create",
  "field:backup:request",
  "field:map:view",
  "field:patrol:operate",
  "field:checkpoint:operate",
  "field:vehicle:search",
  "field:broadcast:view",
  "field:drone:observe",
  "field:shift:operate",
  "field:supervisor:manage",
];

/** Full catalog of field permissions that may map onto a permission profile. */
export const FIELD_CAPABILITY_PERMISSIONS: Permission[] = [
  ...EXISTING_FIELD_PERMISSIONS,
  ...NEW_FIELD_CAPABILITY_PERMISSIONS,
];

export const FIELD_CAPABILITY_PERMISSION_SET = new Set<Permission>(FIELD_CAPABILITY_PERMISSIONS);

/**
 * Permissions that may be assigned to a *device-level* permission profile. Excludes
 * device lifecycle administration permissions (register/manage/approve) which remain
 * admin-console-only capabilities and are never handed to a field device/officer.
 */
export const FIELD_PROFILE_ASSIGNABLE_PERMISSIONS: Permission[] = [
  "field:access",
  "field:session:operate",
  ...NEW_FIELD_CAPABILITY_PERMISSIONS,
];

export const FIELD_PROFILE_ASSIGNABLE_PERMISSION_SET = new Set<Permission>(FIELD_PROFILE_ASSIGNABLE_PERMISSIONS);

export type FieldPermissionGroup = {
  label: string;
  description: string;
  permissions: Permission[];
};

/** Human-labelled groupings of field capability permissions for admin UI presentation. */
export const FIELD_PERMISSION_GROUPS: Record<string, FieldPermissionGroup> = {
  coreAccess: {
    label: "Core Field Access",
    description: "Baseline access required for any field session.",
    permissions: ["field:access", "field:session:operate", "field:map:view", "field:assignment:view"],
  },
  assignmentsAndIncidents: {
    label: "Assignments & Incidents",
    description: "View and act on assigned incidents and dispatch assignments.",
    permissions: [
      "field:assignment:accept",
      "field:incident:view",
      "field:incident:update-status",
      "field:incident:create",
    ],
  },
  patrolOperations: {
    label: "Patrol Operations",
    description: "Operate patrol sessions and shifts.",
    permissions: ["field:patrol:operate", "field:shift:operate"],
  },
  checkpointOperations: {
    label: "Checkpoint Operations",
    description: "Operate checkpoint sessions and vehicle checks.",
    permissions: ["field:checkpoint:operate", "field:vehicle:search"],
  },
  communicationsAndEvidence: {
    label: "Communications & Evidence",
    description: "Send field communications and attach evidence to incidents.",
    permissions: ["field:communication:send", "field:evidence:add"],
  },
  boloAndSightings: {
    label: "BOLO & Sightings",
    description: "View BOLO alerts, report sightings, and view broadcasts.",
    permissions: ["field:bolo:view", "field:sighting:create", "field:broadcast:view"],
  },
  safetyAndBackup: {
    label: "Officer Safety & Backup",
    description: "Request backup during field operations.",
    permissions: ["field:backup:request"],
  },
  droneObservation: {
    label: "Drone Observation",
    description: "Read-only visibility into drone missions relevant to field operations.",
    permissions: ["field:drone:observe"],
  },
  supervisoryOversight: {
    label: "Supervisory Oversight",
    description: "Manage other field officers and delegate permissions within authority.",
    permissions: ["field:supervisor:manage"],
  },
};

export const FIELD_PERM_ERROR_CODES = {
  UNKNOWN_PERMISSION: "FIELD-PERM-001",
  DELEGATION_EXCEEDS_AUTHORITY: "FIELD-PERM-002",
  PROFILE_INACTIVE: "FIELD-PERM-003",
  PROFILE_NOT_FOUND: "FIELD-PERM-004",
  SCOPE_MISMATCH: "FIELD-PERM-005",
} as const;

export type FieldPermErrorCode = (typeof FIELD_PERM_ERROR_CODES)[keyof typeof FIELD_PERM_ERROR_CODES];

const ALL_ASSIGNABLE = FIELD_PROFILE_ASSIGNABLE_PERMISSIONS;
const SUPERVISOR_CORE = ALL_ASSIGNABLE.filter((permission) => permission !== "field:supervisor:manage");

/**
 * Maximum set of field capability permissions each admin role may delegate to a
 * permission profile, pre-provisioned device, or per-device override/deny list.
 *
 * Intentionally scoped to the same roles already trusted to approve/manage field
 * devices (see `canApproveFieldDevices` in field-operations.ts) so this introduces
 * no new admin authority boundary — it only constrains what that existing authority
 * can hand down to field devices. Roles outside that set have an empty ceiling and
 * cannot delegate any field capability permission.
 */
export const FIELD_SUPERVISOR_GRANT_CEILINGS: Record<AdminRoleName, Permission[]> = {
  [AdminRoleName.SuperAdmin]: ALL_ASSIGNABLE,
  [AdminRoleName.CountryAdmin]: ALL_ASSIGNABLE,
  [AdminRoleName.StateAdmin]: ALL_ASSIGNABLE,
  [AdminRoleName.AgencyAdmin]: ALL_ASSIGNABLE,
  [AdminRoleName.LgaAdmin]: SUPERVISOR_CORE,
  [AdminRoleName.PoliceSecurityOfficer]: [],
  [AdminRoleName.CallCenterAgent]: [],
  [AdminRoleName.CommunityModerator]: [],
  [AdminRoleName.OversightAuditor]: [],
  [AdminRoleName.DroneCommander]: [],
  [AdminRoleName.DroneOperator]: [],
  [AdminRoleName.ReadOnlyObserver]: [],
};

export function isFieldCapabilityPermission(value: unknown): value is Permission {
  return typeof value === "string" && FIELD_CAPABILITY_PERMISSION_SET.has(value as Permission);
}

export function isAssignableFieldProfilePermission(value: unknown): value is Permission {
  return typeof value === "string" && FIELD_PROFILE_ASSIGNABLE_PERMISSION_SET.has(value as Permission);
}

export type FieldPermissionCatalogCheck = {
  valid: boolean;
  unknown: string[];
  known: Permission[];
};

/** Rejects arbitrary/unknown permission strings — only codes in the profile-assignable catalog pass. */
export function validateFieldPermissionCatalog(permissions: readonly string[]): FieldPermissionCatalogCheck {
  const unknown: string[] = [];
  const known: Permission[] = [];
  for (const permission of permissions) {
    if (isAssignableFieldProfilePermission(permission)) known.push(permission);
    else unknown.push(permission);
  }
  return { valid: unknown.length === 0, unknown, known };
}

export type FieldPermissionDelegationCheck = {
  allowed: boolean;
  ceiling: Permission[];
  excess: Permission[];
};

/**
 * Checks that every permission a supervisor is about to grant (via a profile,
 * pre-provisioning grant, or per-device override) is within that supervisor's
 * delegation ceiling. Returns the excess (disallowed) permissions rather than
 * throwing, so API callers can raise a framework-appropriate error.
 */
export function validateFieldPermissionDelegation(
  grantorRole: AdminRoleName | string,
  requestedPermissions: readonly Permission[],
): FieldPermissionDelegationCheck {
  const ceiling = FIELD_SUPERVISOR_GRANT_CEILINGS[grantorRole as AdminRoleName] ?? [];
  const ceilingSet = new Set(ceiling);
  const excess = requestedPermissions.filter((permission) => !ceilingSet.has(permission));
  return { allowed: excess.length === 0, ceiling, excess };
}

/**
 * Resolves the effective permission set for a device: profile permissions plus
 * per-device overrides (additive grants within authority), minus per-device denies.
 * Denies always win over overrides so a supervisor can narrow a profile without
 * needing a new profile.
 */
export function resolveEffectiveFieldPermissions(
  profilePermissions: readonly Permission[],
  overrides: readonly Permission[] = [],
  denies: readonly Permission[] = [],
): Permission[] {
  const denySet = new Set(denies);
  const merged = new Set<Permission>([...profilePermissions, ...overrides]);
  for (const denied of denySet) merged.delete(denied);
  return Array.from(merged);
}
