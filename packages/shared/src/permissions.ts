import { AdminRoleName, UserRole } from "./enums";

export type Permission =
  | "incident:create"
  | "incident:read"
  | "incident:update"
  | "incident:assign"
  | "incident:escalate"
  | "broadcast:create"
  | "broadcast:approve"
  | "broadcast:publish"
  | "community:read"
  | "community:join"
  | "community:post"
  | "community:moderate"
  | "community:verify"
  | "community:patrol"
  | "community:volunteer"
  | "audit:read"
  | "user:manage"
  | "agency:manage"
  | "auth:admin"
  | "policy:read"
  | "policy:manage"
  | "drone:read"
  | "drone:manage"
  | "drone:mission:create"
  | "drone:mission:command"
  | "drone:evidence:read";

const droneReadOnly: Permission[] = ["drone:read", "drone:evidence:read", "incident:read", "audit:read", "auth:admin", "policy:read"];
const droneOperatorPerms: Permission[] = [...droneReadOnly, "drone:mission:create"];
const droneCommanderPerms: Permission[] = [...droneOperatorPerms, "drone:manage", "drone:mission:command"];
const droneAdminPerms: Permission[] = [...droneCommanderPerms, "incident:update", "incident:assign"];

export const adminRolePermissions: Record<AdminRoleName, Permission[]> = {
  [AdminRoleName.SuperAdmin]: ["incident:create", "incident:read", "incident:update", "incident:assign", "incident:escalate", "broadcast:create", "broadcast:approve", "broadcast:publish", "community:read", "community:join", "community:post", "community:moderate", "community:verify", "community:patrol", "community:volunteer", "audit:read", "user:manage", "agency:manage", "auth:admin", "policy:read", "policy:manage", ...droneAdminPerms],
  [AdminRoleName.CountryAdmin]: ["incident:read", "incident:update", "incident:assign", "incident:escalate", "broadcast:create", "broadcast:approve", "broadcast:publish", "community:read", "community:moderate", "community:verify", "community:patrol", "audit:read", "user:manage", "agency:manage", "auth:admin", "policy:read", "policy:manage", ...droneAdminPerms],
  [AdminRoleName.StateAdmin]: ["incident:read", "incident:update", "incident:assign", "incident:escalate", "broadcast:create", "broadcast:publish", "community:read", "community:moderate", "community:verify", "community:patrol", "audit:read", "user:manage", "agency:manage", "auth:admin", "policy:read", "policy:manage", ...droneAdminPerms],
  [AdminRoleName.LgaAdmin]: ["incident:read", "incident:update", "incident:assign", "broadcast:create", "community:read", "community:moderate", "community:verify", "community:patrol", "audit:read", "user:manage", "auth:admin", "policy:read", "policy:manage"],
  [AdminRoleName.AgencyAdmin]: ["incident:read", "incident:update", "incident:assign", "incident:escalate", "community:read", "community:verify", "audit:read", "user:manage", "auth:admin", "policy:read"],
  [AdminRoleName.PoliceSecurityOfficer]: ["incident:read", "incident:update", "auth:admin", "policy:read"],
  [AdminRoleName.CallCenterAgent]: ["incident:create", "incident:read", "incident:update", "auth:admin", "policy:read"],
  [AdminRoleName.CommunityModerator]: ["community:read", "community:moderate", "community:verify", "community:patrol", "audit:read", "auth:admin", "policy:read", "policy:manage"],
  [AdminRoleName.OversightAuditor]: ["incident:read", "audit:read", "auth:admin", "policy:read"],
  [AdminRoleName.DroneCommander]: droneCommanderPerms,
  [AdminRoleName.DroneOperator]: droneOperatorPerms,
  [AdminRoleName.ReadOnlyObserver]: droneReadOnly,
};

export const userRolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.Citizen]: ["incident:create", "incident:read", "community:read", "community:join", "community:post", "community:volunteer"],
  [UserRole.TrustedReporter]: ["incident:create", "incident:read", "community:read", "community:join", "community:post", "community:verify", "community:volunteer"],
  [UserRole.Responder]: ["incident:read", "incident:update"],
};

export const rolePermissions = {
  ...adminRolePermissions,
  ...userRolePermissions,
};
