export const DISPATCH_SLA_SECONDS = {
  triage: 120,
  assignment: 300,
  acceptance: 300,
  arrival: 900,
} as const;

export type SlaTimerInput = {
  submittedAt: Date;
  triagedAt?: Date | null;
  assignedAt?: Date | null;
  acceptedAt?: Date | null;
  arrivedAt?: Date | null;
  now?: Date;
};

export type SlaTimerState = {
  secondsSinceReport: number;
  triageDeadlineAt: string;
  assignmentDeadlineAt: string;
  acceptanceDeadlineAt: string | null;
  arrivalDeadlineAt: string | null;
  triageBreached: boolean;
  assignmentBreached: boolean;
  acceptanceBreached: boolean;
  arrivalBreached: boolean;
};

export function buildSlaTimerState(input: SlaTimerInput): SlaTimerState {
  const now = input.now ?? new Date();
  const submittedAt = input.submittedAt;
  const triageDeadline = new Date(submittedAt.getTime() + DISPATCH_SLA_SECONDS.triage * 1000);
  const assignmentDeadline = new Date(submittedAt.getTime() + DISPATCH_SLA_SECONDS.assignment * 1000);
  const acceptanceDeadline = input.assignedAt
    ? new Date(input.assignedAt.getTime() + DISPATCH_SLA_SECONDS.acceptance * 1000)
    : null;
  const arrivalDeadline = input.acceptedAt
    ? new Date(input.acceptedAt.getTime() + DISPATCH_SLA_SECONDS.arrival * 1000)
    : null;

  return {
    secondsSinceReport: Math.max(0, Math.floor((now.getTime() - submittedAt.getTime()) / 1000)),
    triageDeadlineAt: triageDeadline.toISOString(),
    assignmentDeadlineAt: assignmentDeadline.toISOString(),
    acceptanceDeadlineAt: acceptanceDeadline?.toISOString() ?? null,
    arrivalDeadlineAt: arrivalDeadline?.toISOString() ?? null,
    triageBreached: !input.triagedAt && now.getTime() > triageDeadline.getTime(),
    assignmentBreached: !input.assignedAt && now.getTime() > assignmentDeadline.getTime(),
    acceptanceBreached: Boolean(input.assignedAt && !input.acceptedAt && acceptanceDeadline && now.getTime() > acceptanceDeadline.getTime()),
    arrivalBreached: Boolean(input.acceptedAt && !input.arrivedAt && arrivalDeadline && now.getTime() > arrivalDeadline.getTime()),
  };
}
