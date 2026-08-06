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
  | "drone:evidence:read"
  | "drone:operator:read"
  | "drone:operator:create"
  | "drone:operator:update"
  | "drone:operator:verify"
  | "drone:operator:suspend"
  | "drone:operator:assign"
  | "drone:operator:documents:read"
  | "drone:operator:safety:read"
  | "drone:operator:safety:manage"
  | "drone:operator:audit:read"
  | "support:chat:read"
  | "support:chat:reply"
  | "support:chat:assign"
  | "support:chat:escalate"
  | "support:chat:resolve"
  | "support:chat:moderate"
  | "support:internal-note:create"
  | "support:protected-identity:read"
  | "support:audit:read"
  | "field:access"
  | "field:device:register"
  | "field:device:manage"
  | "field:device:approve"
  | "field:session:operate";

const supportRead: Permission[] = ["support:chat:read", "incident:read", "auth:admin", "policy:read"];
const supportAgent: Permission[] = [...supportRead, "support:chat:reply", "support:chat:assign", "support:chat:resolve", "support:internal-note:create"];
const supportSupervisor: Permission[] = [...supportAgent, "support:chat:escalate", "support:chat:moderate", "support:protected-identity:read", "support:audit:read", "incident:update", "incident:assign"];
const droneOperatorRead: Permission[] = ["drone:operator:read", "drone:read"];
const droneOperatorManage: Permission[] = [...droneOperatorRead, "drone:operator:create", "drone:operator:update", "drone:operator:assign"];
const droneOperatorVerify: Permission[] = [...droneOperatorManage, "drone:operator:verify", "drone:operator:suspend", "drone:operator:documents:read", "drone:operator:safety:read", "drone:operator:safety:manage", "drone:operator:audit:read"];
const droneReadOnly: Permission[] = [...droneOperatorRead, "drone:evidence:read", "incident:read", "audit:read", "auth:admin", "policy:read", "drone:operator:audit:read"];
const droneOperatorPerms: Permission[] = [...droneReadOnly, "drone:mission:create", "drone:operator:update"];
const droneCommanderPerms: Permission[] = [...droneOperatorPerms, "drone:manage", "drone:mission:command", ...droneOperatorManage.filter((p) => p !== "drone:operator:verify"), "drone:operator:documents:read", "drone:operator:safety:read", "drone:operator:safety:manage"];
const droneAdminPerms: Permission[] = [...droneCommanderPerms, "drone:operator:verify", "drone:operator:suspend", "incident:update", "incident:assign"];
const fieldOperate: Permission[] = ["field:access", "field:session:operate", "incident:read", "incident:update", "auth:admin", "policy:read"];
const fieldRegister: Permission[] = ["field:device:register", "auth:admin", "policy:read"];
const fieldDeviceManage: Permission[] = ["field:device:manage", "field:device:approve", "audit:read", "auth:admin", "policy:read"];
const oversightDroneRead: Permission[] = ["drone:operator:read", "drone:read", "drone:operator:audit:read", "drone:operator:documents:read", "incident:read", "audit:read", "auth:admin", "policy:read"];

export const adminRolePermissions: Record<AdminRoleName, Permission[]> = {
  [AdminRoleName.SuperAdmin]: ["incident:create", "incident:read", "incident:update", "incident:assign", "incident:escalate", "broadcast:create", "broadcast:approve", "broadcast:publish", "community:read", "community:join", "community:post", "community:moderate", "community:verify", "community:patrol", "community:volunteer", "audit:read", "user:manage", "agency:manage", "auth:admin", "policy:read", "policy:manage", ...supportSupervisor, ...droneAdminPerms],
  [AdminRoleName.CountryAdmin]: ["incident:read", "incident:update", "incident:assign", "incident:escalate", "broadcast:create", "broadcast:approve", "broadcast:publish", "community:read", "community:moderate", "community:verify", "community:patrol", "audit:read", "user:manage", "agency:manage", "auth:admin", "policy:read", "policy:manage", ...supportSupervisor, ...droneAdminPerms],
  [AdminRoleName.StateAdmin]: ["incident:read", "incident:update", "incident:assign", "incident:escalate", "broadcast:create", "broadcast:publish", "community:read", "community:moderate", "community:verify", "community:patrol", "audit:read", "user:manage", "agency:manage", "auth:admin", "policy:read", "policy:manage", ...fieldDeviceManage, ...supportSupervisor, ...droneAdminPerms],
  [AdminRoleName.LgaAdmin]: ["incident:read", "incident:update", "incident:assign", "broadcast:create", "community:read", "community:moderate", "community:verify", "community:patrol", "audit:read", "user:manage", "auth:admin", "policy:read", "policy:manage", ...fieldDeviceManage, ...supportAgent],
  [AdminRoleName.AgencyAdmin]: ["incident:read", "incident:update", "incident:assign", "incident:escalate", "community:read", "community:verify", "audit:read", "user:manage", "auth:admin", "policy:read", ...fieldOperate, ...fieldRegister, ...fieldDeviceManage, ...supportRead],
  [AdminRoleName.PoliceSecurityOfficer]: ["incident:read", "incident:update", "auth:admin", "policy:read", ...fieldOperate, ...fieldRegister, ...supportRead],
  [AdminRoleName.CallCenterAgent]: ["incident:create", "incident:read", "incident:update", "auth:admin", "policy:read", ...fieldOperate, ...fieldRegister, ...supportAgent],
  [AdminRoleName.CommunityModerator]: ["community:read", "community:moderate", "community:verify", "community:patrol", "audit:read", "auth:admin", "policy:read", "policy:manage"],
  [AdminRoleName.OversightAuditor]: [...oversightDroneRead, "support:audit:read", "support:chat:read"],
  [AdminRoleName.DroneCommander]: droneCommanderPerms,
  [AdminRoleName.DroneOperator]: [...droneOperatorPerms, ...fieldOperate, ...fieldRegister],
  [AdminRoleName.ReadOnlyObserver]: [...droneReadOnly, ...fieldOperate],
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
