import type { JwtPayload } from "../../common/auth/jwt";

export type CommunityRoleName =
  | "CommunityModerator"
  | "EstateAdmin"
  | "SecurityCoordinator"
  | "PoliceLiaison"
  | "VolunteerCoordinator"
  | "VerifiedVolunteer"
  | "Resident";

export type CommunityAction =
  | "read"
  | "join"
  | "post"
  | "comment"
  | "react"
  | "report"
  | "volunteer"
  | "patrol_checkpoint"
  | "patrol_create"
  | "moderate_member"
  | "moderate_content"
  | "verify_post"
  | "assign_role"
  | "community_statistics"
  | "leave";

const MODERATOR_ROLES: CommunityRoleName[] = [
  "CommunityModerator",
  "EstateAdmin",
  "SecurityCoordinator",
  "PoliceLiaison",
  "VolunteerCoordinator",
];

const COMMUNITY_ADMIN_ROLES: CommunityRoleName[] = ["CommunityModerator", "EstateAdmin"];

const PATROL_ROLES: CommunityRoleName[] = [
  "SecurityCoordinator",
  "VolunteerCoordinator",
  "VerifiedVolunteer",
];

const matrix: Record<CommunityRoleName, Set<CommunityAction>> = {
  Resident: new Set(["read", "join", "post", "comment", "react", "report", "volunteer", "leave"]),
  VerifiedVolunteer: new Set([
    "read",
    "join",
    "post",
    "comment",
    "react",
    "report",
    "volunteer",
    "patrol_checkpoint",
    "leave",
  ]),
  VolunteerCoordinator: new Set([
    "read",
    "join",
    "post",
    "comment",
    "react",
    "report",
    "volunteer",
    "patrol_checkpoint",
    "patrol_create",
    "leave",
  ]),
  SecurityCoordinator: new Set([
    "read",
    "join",
    "post",
    "comment",
    "react",
    "report",
    "volunteer",
    "patrol_checkpoint",
    "patrol_create",
    "moderate_member",
    "moderate_content",
    "verify_post",
    "community_statistics",
    "leave",
  ]),
  PoliceLiaison: new Set([
    "read",
    "join",
    "post",
    "comment",
    "react",
    "report",
    "volunteer",
    "moderate_content",
    "verify_post",
    "community_statistics",
    "leave",
  ]),
  CommunityModerator: new Set([
    "read",
    "join",
    "post",
    "comment",
    "react",
    "report",
    "volunteer",
    "patrol_checkpoint",
    "patrol_create",
    "moderate_member",
    "moderate_content",
    "verify_post",
    "assign_role",
    "community_statistics",
    "leave",
  ]),
  EstateAdmin: new Set([
    "read",
    "join",
    "post",
    "comment",
    "react",
    "report",
    "volunteer",
    "patrol_checkpoint",
    "patrol_create",
    "moderate_member",
    "moderate_content",
    "verify_post",
    "assign_role",
    "community_statistics",
    "leave",
  ]),
};

export function platformAdminCan(actor: JwtPayload, action: CommunityAction): boolean {
  if (actor.typ !== "admin") return false;
  if (actor.role === "Super Admin") return true;
  if (["Country Admin", "State Admin", "LGA Admin", "Community Moderator"].includes(String(actor.role))) {
    return ["read", "moderate_member", "moderate_content", "verify_post", "assign_role", "community_statistics"].includes(action);
  }
  return false;
}

export function communityRoleCan(roleName: string | undefined, action: CommunityAction): boolean {
  if (!roleName) return action === "read" || action === "join";
  const role = roleName as CommunityRoleName;
  return matrix[role]?.has(action) ?? false;
}

export function isModeratorRole(roleName?: string | null): boolean {
  return !!roleName && MODERATOR_ROLES.includes(roleName as CommunityRoleName);
}

export function isCommunityAdminRole(roleName?: string | null): boolean {
  return !!roleName && COMMUNITY_ADMIN_ROLES.includes(roleName as CommunityRoleName);
}

export function canPatrol(roleName?: string | null): boolean {
  return !!roleName && PATROL_ROLES.includes(roleName as CommunityRoleName);
}

export const COMMUNITY_PERMISSION_MATRIX = Object.fromEntries(
  Object.entries(matrix).map(([role, actions]) => [role, [...actions]]),
);
