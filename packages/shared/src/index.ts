export enum UserRole {
  Citizen = "citizen",
  TrustedReporter = "trusted_reporter",
  Responder = "responder",
}

export enum AdminRoleName {
  SuperAdmin = "Super Admin",
  CountryAdmin = "Country Admin",
  StateAdmin = "State Admin",
  LgaAdmin = "LGA Admin",
  AgencyAdmin = "Agency Admin",
  PoliceSecurityOfficer = "Police/Security Officer",
  CallCenterAgent = "Call Center Agent",
  OversightAuditor = "Oversight Auditor",
}

export enum IncidentType {
  Emergency = "Emergency",
  Crime = "Crime",
  Accident = "Accident",
  Fire = "Fire",
  Medical = "Medical",
  CommunitySafety = "CommunitySafety",
  Kidnapping = "Kidnapping",
  Abuse = "Abuse",
  SuspiciousActivity = "SuspiciousActivity",
  MissingPerson = "MissingPerson",
  StolenVehicle = "StolenVehicle",
  SOS = "SOS",
}

export enum IncidentStatus {
  Submitted = "Submitted",
  Received = "Received",
  Verifying = "Verifying",
  Verified = "Verified",
  Assigned = "Assigned",
  Responding = "Responding",
  Resolved = "Resolved",
  Closed = "Closed",
  FalseReport = "FalseReport",
}

export enum IncidentPriority {
  P1LifeThreatening = "P1LifeThreatening",
  P2ActiveCrimeAccident = "P2ActiveCrimeAccident",
  P3SuspiciousActivity = "P3SuspiciousActivity",
  P4GeneralSafety = "P4GeneralSafety",
}

export enum BroadcastType {
  Emergency = "Emergency",
  Crime = "Crime",
  Accident = "Accident",
  MissingPerson = "MissingPerson",
  StolenVehicle = "StolenVehicle",
  GovernmentAlert = "GovernmentAlert",
  CommunityWarning = "CommunityWarning",
}

export enum BroadcastStatus {
  Draft = "Draft",
  PendingApproval = "PendingApproval",
  Published = "Published",
  Expired = "Expired",
  Cancelled = "Cancelled",
  Rejected = "Rejected",
}

export enum CommunityRoleName {
  CommunityModerator = "Community Moderator",
  EstateAdmin = "Estate Admin",
  SecurityCoordinator = "Security Coordinator",
  PoliceLiaison = "Police Liaison",
  VolunteerCoordinator = "Volunteer Coordinator",
  VerifiedVolunteer = "Verified Volunteer",
  Resident = "Resident",
}

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


