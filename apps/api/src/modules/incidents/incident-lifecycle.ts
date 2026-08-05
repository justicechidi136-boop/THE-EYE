import { AdminRoleName, IncidentStatus } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";

/** Authoritative incident status transition matrix (server-side). */
export const allowedIncidentTransitions: Record<IncidentStatus, IncidentStatus[]> = {
  [IncidentStatus.Submitted]: [
    IncidentStatus.Received,
    IncidentStatus.FalseReport,
    IncidentStatus.CancelledByReporter,
    IncidentStatus.ExpiredAfterReview,
  ],
  [IncidentStatus.Received]: [
    IncidentStatus.Verifying,
    IncidentStatus.FalseReport,
    IncidentStatus.CancelledByReporter,
    IncidentStatus.ExpiredAfterReview,
  ],
  [IncidentStatus.Verifying]: [
    IncidentStatus.Verified,
    IncidentStatus.FalseReport,
    IncidentStatus.CancelledByReporter,
    IncidentStatus.ExpiredAfterReview,
  ],
  [IncidentStatus.Verified]: [
    IncidentStatus.Assigned,
    IncidentStatus.FalseReport,
    IncidentStatus.CancelledByReporter,
    IncidentStatus.ExpiredAfterReview,
  ],
  [IncidentStatus.Assigned]: [
    IncidentStatus.Responding,
    IncidentStatus.CancellationRequested,
    IncidentStatus.FalseReport,
  ],
  [IncidentStatus.Responding]: [
    IncidentStatus.UnderControl,
    IncidentStatus.CancellationRequested,
    IncidentStatus.FalseReport,
  ],
  [IncidentStatus.UnderControl]: [
    IncidentStatus.Resolved,
    IncidentStatus.CancellationRequested,
    IncidentStatus.FalseReport,
  ],
  [IncidentStatus.CancellationRequested]: [
    IncidentStatus.CancelledByReporter,
    IncidentStatus.Assigned,
    IncidentStatus.Responding,
    IncidentStatus.UnderControl,
    IncidentStatus.Resolved,
    IncidentStatus.Closed,
  ],
  [IncidentStatus.Resolved]: [IncidentStatus.Closed],
  [IncidentStatus.Closed]: [],
  [IncidentStatus.FalseReport]: [],
  [IncidentStatus.CancelledByReporter]: [],
  [IncidentStatus.ExpiredAfterReview]: [],
};

const terminalStatuses = new Set<IncidentStatus>([
  IncidentStatus.Closed,
  IncidentStatus.FalseReport,
  IncidentStatus.CancelledByReporter,
  IncidentStatus.ExpiredAfterReview,
]);

const activeStatuses = new Set<IncidentStatus>([
  IncidentStatus.Submitted,
  IncidentStatus.Received,
  IncidentStatus.Verifying,
  IncidentStatus.Verified,
  IncidentStatus.Assigned,
  IncidentStatus.Responding,
  IncidentStatus.UnderControl,
  IncidentStatus.CancellationRequested,
]);

const reporterDirectCancelStatuses = new Set<IncidentStatus>([
  IncidentStatus.Submitted,
  IncidentStatus.Received,
  IncidentStatus.Verifying,
  IncidentStatus.Verified,
]);

const reporterRequestCancellationStatuses = new Set<IncidentStatus>([
  IncidentStatus.Assigned,
  IncidentStatus.Responding,
  IncidentStatus.UnderControl,
]);

export function canTransitionIncident(from: IncidentStatus, to: IncidentStatus): boolean {
  return allowedIncidentTransitions[from]?.includes(to) ?? false;
}

export function isTerminalIncidentStatus(status: IncidentStatus): boolean {
  return terminalStatuses.has(status);
}

export function isActiveIncidentStatus(status: IncidentStatus): boolean {
  return activeStatuses.has(status);
}

export function canReporterCancelDirectly(status: IncidentStatus): boolean {
  return reporterDirectCancelStatuses.has(status);
}

export function canReporterRequestCancellation(status: IncidentStatus): boolean {
  return reporterRequestCancellationStatuses.has(status);
}

const adminRoles = new Set<AdminRoleName>([
  AdminRoleName.SuperAdmin,
  AdminRoleName.CountryAdmin,
  AdminRoleName.StateAdmin,
  AdminRoleName.LgaAdmin,
  AdminRoleName.AgencyAdmin,
  AdminRoleName.PoliceSecurityOfficer,
  AdminRoleName.CallCenterAgent,
]);

export function canActorTransitionIncident(
  actor: JwtPayload | undefined,
  from: IncidentStatus,
  to: IncidentStatus,
): boolean {
  if (!canTransitionIncident(from, to)) return false;
  if (!actor) return false;

  if (actor.typ === "user") {
    if (to === IncidentStatus.CancelledByReporter && canReporterCancelDirectly(from)) {
      return true;
    }
    if (to === IncidentStatus.CancellationRequested && canReporterRequestCancellation(from)) {
      return true;
    }
    return false;
  }

  if (actor.typ === "admin") {
    if (actor.role === AdminRoleName.OversightAuditor) return false;
    if (!adminRoles.has(actor.role as AdminRoleName)) return false;
    return true;
  }

  return false;
}

/** Statuses eligible for administrative expiry review. */
export function canExpireAfterReview(status: IncidentStatus): boolean {
  return (
    status === IncidentStatus.Submitted ||
    status === IncidentStatus.Received ||
    status === IncidentStatus.Verifying ||
    status === IncidentStatus.Verified
  );
}
