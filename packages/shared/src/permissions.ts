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
  | "auth:admin";

export const adminRolePermissions: Record<AdminRoleName, Permission[]> = {
  [AdminRoleName.SuperAdmin]: ["incident:create", "incident:read", "incident:update", "incident:assign", "incident:escalate", "broadcast:create", "broadcast:approve", "broadcast:publish", "community:read", "community:join", "community:post", "community:moderate", "community:verify", "community:patrol", "community:volunteer", "audit:read", "user:manage", "agency:manage", "auth:admin"],
  [AdminRoleName.CountryAdmin]: ["incident:read", "incident:update", "incident:assign", "incident:escalate", "broadcast:create", "broadcast:approve", "broadcast:publish", "community:read", "community:moderate", "community:verify", "community:patrol", "audit:read", "user:manage", "agency:manage", "auth:admin"],
  [AdminRoleName.StateAdmin]: ["incident:read", "incident:update", "incident:assign", "incident:escalate", "broadcast:create", "broadcast:publish", "community:read", "community:moderate", "community:verify", "community:patrol", "audit:read", "user:manage", "agency:manage", "auth:admin"],
  [AdminRoleName.LgaAdmin]: ["incident:read", "incident:update", "incident:assign", "broadcast:create", "community:read", "community:moderate", "community:verify", "community:patrol", "audit:read", "user:manage", "auth:admin"],
  [AdminRoleName.AgencyAdmin]: ["incident:read", "incident:update", "incident:assign", "incident:escalate", "community:read", "community:verify", "audit:read", "user:manage", "auth:admin"],
  [AdminRoleName.PoliceSecurityOfficer]: ["incident:read", "incident:update", "auth:admin"],
  [AdminRoleName.CallCenterAgent]: ["incident:create", "incident:read", "incident:update", "auth:admin"],
  [AdminRoleName.CommunityModerator]: ["community:read", "community:moderate", "community:verify", "community:patrol", "audit:read", "auth:admin"],
  [AdminRoleName.OversightAuditor]: ["incident:read", "audit:read", "auth:admin"],
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
