import { IncidentAssignmentStatus } from "@the-eye/shared";

export const allowedAssignmentTransitions: Record<IncidentAssignmentStatus, IncidentAssignmentStatus[]> = {
  [IncidentAssignmentStatus.Proposed]: [IncidentAssignmentStatus.Assigned, IncidentAssignmentStatus.Cancelled],
  [IncidentAssignmentStatus.Assigned]: [
    IncidentAssignmentStatus.Accepted,
    IncidentAssignmentStatus.Declined,
    IncidentAssignmentStatus.Expired,
    IncidentAssignmentStatus.Cancelled,
    IncidentAssignmentStatus.Reassigned,
  ],
  [IncidentAssignmentStatus.Accepted]: [
    IncidentAssignmentStatus.EnRoute,
    IncidentAssignmentStatus.Declined,
    IncidentAssignmentStatus.Cancelled,
    IncidentAssignmentStatus.Reassigned,
  ],
  [IncidentAssignmentStatus.EnRoute]: [
    IncidentAssignmentStatus.Arrived,
    IncidentAssignmentStatus.Cancelled,
    IncidentAssignmentStatus.Reassigned,
  ],
  [IncidentAssignmentStatus.Arrived]: [
    IncidentAssignmentStatus.InProgress,
    IncidentAssignmentStatus.Completed,
    IncidentAssignmentStatus.Cancelled,
  ],
  [IncidentAssignmentStatus.InProgress]: [IncidentAssignmentStatus.Completed, IncidentAssignmentStatus.Cancelled],
  [IncidentAssignmentStatus.Declined]: [],
  [IncidentAssignmentStatus.Expired]: [],
  [IncidentAssignmentStatus.Reassigned]: [],
  [IncidentAssignmentStatus.Completed]: [],
  [IncidentAssignmentStatus.Cancelled]: [],
};

export function canTransitionAssignment(from: IncidentAssignmentStatus, to: IncidentAssignmentStatus): boolean {
  return allowedAssignmentTransitions[from]?.includes(to) ?? false;
}

export const ACTIVE_ASSIGNMENT_STATUSES: IncidentAssignmentStatus[] = [
  IncidentAssignmentStatus.Proposed,
  IncidentAssignmentStatus.Assigned,
  IncidentAssignmentStatus.Accepted,
  IncidentAssignmentStatus.EnRoute,
  IncidentAssignmentStatus.Arrived,
  IncidentAssignmentStatus.InProgress,
];

export const ASSIGNMENT_ACCEPT_TIMEOUT_SECONDS = 300;

export const ASSIGNMENT_ACTION_TO_STATUS: Record<string, IncidentAssignmentStatus> = {
  accept: IncidentAssignmentStatus.Accepted,
  decline: IncidentAssignmentStatus.Declined,
  en_route: IncidentAssignmentStatus.EnRoute,
  arrive: IncidentAssignmentStatus.Arrived,
  in_progress: IncidentAssignmentStatus.InProgress,
  complete: IncidentAssignmentStatus.Completed,
  cancel: IncidentAssignmentStatus.Cancelled,
};

export const LOCATION_STALE_SECONDS = 120;
