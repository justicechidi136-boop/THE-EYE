import { AdminRoleName, adminRolePermissions } from "@the-eye/shared";
import type { RoleMatrixRow } from "./types/admin-views";
import { roleScope } from "./types/admin-views";

function incidentAccess(role: AdminRoleName): string {
  if (role === AdminRoleName.SuperAdmin) return "All incidents";
  if (role === AdminRoleName.OversightAuditor) return "Read-only history";
  if (role === AdminRoleName.AgencyAdmin || role === AdminRoleName.PoliceSecurityOfficer) return "Assigned agency incidents";
  if (role === AdminRoleName.CallCenterAgent) return "Assigned LGA intake";
  if (role === AdminRoleName.CommunityModerator) return "Linked community incidents";
  if (role === AdminRoleName.CountryAdmin) return "Country only";
  if (role === AdminRoleName.StateAdmin) return "State only";
  return "LGA only";
}

function canModifyIncidents(role: AdminRoleName): string {
  const permissions = adminRolePermissions[role];
  if (!permissions.includes("incident:update")) return "No";
  if (role === AdminRoleName.OversightAuditor) return "No";
  if (role === AdminRoleName.PoliceSecurityOfficer) return "Response updates";
  if (role === AdminRoleName.CallCenterAgent) return "Triage and assign";
  if (role === AdminRoleName.CommunityModerator) return "Convert or escalate posts";
  if (role === AdminRoleName.AgencyAdmin) return "Assignment response only";
  return "Yes";
}

function communityAccess(role: AdminRoleName): string {
  const permissions = adminRolePermissions[role];
  if (!permissions.includes("community:read")) return "Escalation queue only";
  if (role === AdminRoleName.CommunityModerator) return "Manage assigned communities";
  if (role === AdminRoleName.SuperAdmin) return "All communities";
  if (role === AdminRoleName.OversightAuditor) return "Read-only moderation audit";
  return "Scoped communities";
}

function auditAccess(role: AdminRoleName): string {
  const permissions = adminRolePermissions[role];
  if (!permissions.includes("audit:read")) return "Own actions";
  if (role === AdminRoleName.SuperAdmin || role === AdminRoleName.OversightAuditor) return "Full read-only";
  return "Scoped";
}

export const roleMatrixRows: RoleMatrixRow[] = Object.values(AdminRoleName).map((role) => ({
  role,
  scope: roleScope[role],
  incidentAccess: incidentAccess(role),
  canModifyIncidents: canModifyIncidents(role),
  communityAccess: communityAccess(role),
  auditAccess: auditAccess(role),
}));
