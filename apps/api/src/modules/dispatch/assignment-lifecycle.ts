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
    IncidentAssignmentStatus.Arrived,
    IncidentAssignmentStatus.Completed,
    IncidentAssignmentStatus.Cancelled,
    IncidentAssignmentStatus.Reassigned,
  ],
  [IncidentAssignmentStatus.Declined]: [],
  [IncidentAssignmentStatus.Expired]: [],
  [IncidentAssignmentStatus.Reassigned]: [],
  [IncidentAssignmentStatus.Arrived]: [IncidentAssignmentStatus.Completed, IncidentAssignmentStatus.Cancelled],
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
  IncidentAssignmentStatus.Arrived,
];

export const ASSIGNMENT_ACCEPT_TIMEOUT_SECONDS = 300;
