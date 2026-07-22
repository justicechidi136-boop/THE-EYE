import { Panel, StatusBadge } from "../ui";
import { countdownLabel, formatDuration, type SlaTimerState } from "../../lib/dispatch/sla-display";

type IncidentSlaPanelProps = {
  sla?: SlaTimerState | null;
  citizenLocationStale?: boolean;
  responderLocationStale?: boolean;
  citizenLocationUpdatedAt?: string | null;
  responderLocationUpdatedAt?: string | null;
};

export function IncidentSlaPanel({
  sla,
  citizenLocationStale,
  responderLocationStale,
  citizenLocationUpdatedAt,
  responderLocationUpdatedAt,
}: IncidentSlaPanelProps) {
  if (!sla) {
    return (
      <Panel title="Operational timers">
        <p className="text-sm text-muted-foreground">SLA timers unavailable for this incident.</p>
      </Panel>
    );
  }

  const rows = [
    { label: "Time since report", value: formatDuration(sla.secondsSinceReport), breached: false },
    { label: "Triage deadline", value: countdownLabel(sla.triageDeadlineAt), breached: sla.triageBreached },
    { label: "Assignment deadline", value: countdownLabel(sla.assignmentDeadlineAt), breached: sla.assignmentBreached },
    { label: "Acceptance deadline", value: countdownLabel(sla.acceptanceDeadlineAt), breached: sla.acceptanceBreached },
    { label: "Arrival SLA", value: countdownLabel(sla.arrivalDeadlineAt), breached: sla.arrivalBreached },
  ];

  return (
    <Panel title="Operational timers (UTC)">
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 rounded-md border p-2">
            <span>{row.label}</span>
            <StatusBadge tone={row.breached ? "danger" : "neutral"}>{row.value}</StatusBadge>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
        <p>
          Citizen location: {citizenLocationUpdatedAt ? new Date(citizenLocationUpdatedAt).toISOString() : "No fix yet"}
          {citizenLocationStale ? " · STALE" : ""}
        </p>
        <p>
          Responder location: {responderLocationUpdatedAt ? new Date(responderLocationUpdatedAt).toISOString() : "No fix yet"}
          {responderLocationStale ? " · STALE" : ""}
        </p>
        <p>Escalation actions shown here are manual unless an automated SLA worker is deployed.</p>
      </div>
    </Panel>
  );
}
