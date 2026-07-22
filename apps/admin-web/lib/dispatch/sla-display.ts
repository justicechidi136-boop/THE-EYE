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

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  return `${mins}m ${seconds % 60}s`;
}

export function countdownLabel(deadlineIso: string | null | undefined, now = Date.now()): string {
  if (!deadlineIso) return "Not started";
  const remainingMs = Date.parse(deadlineIso) - now;
  if (Number.isNaN(remainingMs)) return "Unknown";
  if (remainingMs <= 0) return "Breached";
  return formatDuration(Math.floor(remainingMs / 1000));
}
