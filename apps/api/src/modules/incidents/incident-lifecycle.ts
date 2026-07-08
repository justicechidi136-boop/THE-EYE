import { IncidentStatus } from "@the-eye/shared";

export const allowedIncidentTransitions: Record<IncidentStatus, IncidentStatus[]> = {
  [IncidentStatus.Submitted]: [IncidentStatus.Received, IncidentStatus.FalseReport],
  [IncidentStatus.Received]: [IncidentStatus.Verifying, IncidentStatus.FalseReport],
  [IncidentStatus.Verifying]: [IncidentStatus.Verified, IncidentStatus.FalseReport],
  [IncidentStatus.Verified]: [IncidentStatus.Assigned, IncidentStatus.FalseReport],
  [IncidentStatus.Assigned]: [IncidentStatus.Responding, IncidentStatus.FalseReport],
  [IncidentStatus.Responding]: [IncidentStatus.Resolved, IncidentStatus.FalseReport],
  [IncidentStatus.Resolved]: [IncidentStatus.Closed],
  [IncidentStatus.Closed]: [],
  [IncidentStatus.FalseReport]: [],
};

export function canTransitionIncident(from: IncidentStatus, to: IncidentStatus): boolean {
  return allowedIncidentTransitions[from]?.includes(to) ?? false;
}
