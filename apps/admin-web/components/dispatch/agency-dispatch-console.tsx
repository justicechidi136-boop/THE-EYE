"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ConsoleDataTable,
  ConsoleEmptyState,
  ConsoleFilterBar,
  ConsoleFilterSelect,
  ConsoleSearchInput,
} from "../console";
import { Button, InlineAlert } from "../form-primitives";
import { Panel, StatusBadge } from "../ui";
import type { DispatchIncident, DispatchResponder } from "../../lib/api/dispatch";
import {
  incidentIsSilent,
  incidentSlaLabel,
  incidentSlaTone,
  priorityShort,
  priorityTone,
  secondsSinceSubmitted,
  workloadSummary,
} from "../../lib/dispatch/console-utils";
import { formatDuration } from "../../lib/dispatch/sla-display";

type AgencyDispatchConsoleProps = {
  unassigned: DispatchIncident[];
  assigned: DispatchIncident[];
  responding: DispatchIncident[];
  responders: DispatchResponder[];
};

export function AgencyDispatchConsole({
  unassigned,
  assigned,
  responding,
  responders,
}: AgencyDispatchConsoleProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState(unassigned[0]?.id ?? assigned[0]?.id ?? "");
  const [responderId, setResponderId] = useState(responders[0]?.id ?? "");
  const [agencyId, setAgencyId] = useState(responders[0]?.agencyId ?? "");
  const [reason, setReason] = useState("");

  const summary = useMemo(
    () => workloadSummary([...unassigned, ...assigned, ...responding], responders),
    [unassigned, assigned, responding, responders],
  );

  async function runResponderAction(responderTargetId: string, availability: string) {
    setBusy(`responder-${responderTargetId}`);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/dispatch/responders/${responderTargetId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability, note: "Updated from agency dispatch console" }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Availability update failed");
      setMessage(`Responder set to ${availability}.`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Availability update failed");
    } finally {
      setBusy(null);
    }
  }

  async function runIncidentAction(action: string, body?: Record<string, unknown>) {
    if (!selectedIncidentId) return;
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/dispatch/incidents/${selectedIncidentId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? `${action} failed`);
      setMessage(`${action} completed.`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `${action} failed`);
    } finally {
      setBusy(null);
    }
  }

  function incidentRowCells(incident: DispatchIncident, selectable = false) {
    const elapsed = secondsSinceSubmitted(incident);
    return [
      <div key={`title-${incident.id}`}>
        {selectable ? (
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name="selected-incident"
              checked={selectedIncidentId === incident.id}
              onChange={() => setSelectedIncidentId(incident.id)}
              className="mt-1"
            />
            <span>
              <span className="font-semibold">{incident.title}</span>
              <span className="mt-1 block text-xs text-muted">{incident.id}</span>
            </span>
          </label>
        ) : (
          <>
            <p className="font-semibold">{incident.title}</p>
            <p className="text-xs text-muted">{incident.id}</p>
          </>
        )}
      </div>,
      incident.type,
      <StatusBadge key={`priority-${incident.id}`} tone={priorityTone(incident.priority)}>{priorityShort(incident.priority)}</StatusBadge>,
      incident.status,
      <StatusBadge key={`sla-${incident.id}`} tone={incidentSlaTone(incident)}>{incidentSlaLabel(incident)}</StatusBadge>,
      incident.liveLocationStale ? <StatusBadge key={`stale-${incident.id}`} tone="warning">Stale location</StatusBadge> : "Fresh",
      incidentIsSilent(incident) ? <StatusBadge key={`silent-${incident.id}`} tone="warning">Silent SOS</StatusBadge> : "—",
      elapsed !== null ? formatDuration(elapsed) : "—",
      <Link key={`open-${incident.id}`} href={`/dispatch/incidents/${incident.id}`} className="text-sm font-semibold text-eye hover:underline">
        Open
      </Link>,
    ];
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">Unassigned queue</p>
          <strong className="mt-2 block text-2xl text-ink">{summary.unassigned}</strong>
        </article>
        <article className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">Agency assigned</p>
          <strong className="mt-2 block text-2xl text-ink">{summary.assigned}</strong>
        </article>
        <article className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">Responders available</p>
          <strong className="mt-2 block text-2xl text-eye">{summary.availableResponders}</strong>
          <span className="mt-2 block text-xs text-muted">{summary.busyResponders} busy · {summary.responders} total</span>
        </article>
        <article className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">Stale locations</p>
          <strong className="mt-2 block text-2xl text-warning">{summary.stale}</strong>
        </article>
      </div>

      <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
        <ConsoleFilterBar>
          <ConsoleSearchInput label="Search loaded incidents" placeholder="Filter client-side by title or ID" name="agencyQ" />
          <ConsoleFilterSelect
            name="agencyPriority"
            label="Priority"
            options={[
              { value: "P1LifeThreatening", label: "P1" },
              { value: "P2ActiveCrimeAccident", label: "P2" },
              { value: "P3SuspiciousActivity", label: "P3" },
              { value: "P4GeneralSafety", label: "P4" },
            ]}
          />
        </ConsoleFilterBar>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-5">
          <Panel title="Unassigned incidents" aside={<StatusBadge tone="warning">{unassigned.length}</StatusBadge>}>
            {unassigned.length ? (
              <ConsoleDataTable
                columns={["Incident", "Type", "Priority", "Status", "SLA", "Location", "Mode", "Elapsed", ""]}
                rows={unassigned.map((incident) => incidentRowCells(incident, true))}
              />
            ) : (
              <ConsoleEmptyState title="No unassigned incidents" detail="Verified incidents awaiting agency assignment appear here." />
            )}
          </Panel>
          <Panel title="Agency-assigned incidents" aside={<StatusBadge tone="info">{assigned.length + responding.length}</StatusBadge>}>
            {assigned.length || responding.length ? (
              <ConsoleDataTable
                columns={["Incident", "Type", "Priority", "Status", "SLA", "Location", "Mode", "Elapsed", ""]}
                rows={[...assigned, ...responding].map((incident) => incidentRowCells(incident))}
              />
            ) : (
              <ConsoleEmptyState title="No active agency assignments" />
            )}
          </Panel>
        </div>

        <div className="grid gap-5">
          <Panel title="Assignment actions">
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                Responder
                <select
                  className="rounded-md border border-line bg-surface px-3 py-2"
                  value={responderId}
                  onChange={(event) => {
                    const next = responders.find((item) => item.id === event.target.value);
                    setResponderId(event.target.value);
                    if (next) setAgencyId(next.agencyId);
                  }}
                >
                  {responders.map((responder) => (
                    <option key={responder.id} value={responder.id}>
                      {responder.displayName} · {responder.availability}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Reason / note
                <textarea
                  className="min-h-20 rounded-md border border-line px-3 py-2"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Required for reassignment and escalation"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy !== null || !selectedIncidentId || !responderId}
                  onClick={() =>
                    runIncidentAction("assign", {
                      agencyId,
                      responderId,
                      reason: reason || "Assigned from agency dispatch console",
                      clientAssignmentId: crypto.randomUUID(),
                    })
                  }
                >
                  Assign responder
                </Button>
                <Button
                  disabled={busy !== null || !selectedIncidentId || reason.trim().length < 5}
                  onClick={() =>
                    runIncidentAction("reassign", {
                      agencyId,
                      responderId,
                      reason: reason.trim(),
                      clientAssignmentId: crypto.randomUUID(),
                    })
                  }
                >
                  Reassign
                </Button>
                <Button
                  disabled={busy !== null || !selectedIncidentId}
                  variant="danger"
                  onClick={() => runIncidentAction("escalate", { reason: reason || "Escalated from agency console" })}
                >
                  Escalate
                </Button>
                <Button
                  disabled={busy !== null || !selectedIncidentId}
                  onClick={() => runIncidentAction("request-info", { reason: reason || "Agency requested more information" })}
                >
                  Request information
                </Button>
              </div>
            </div>
          </Panel>

          <Panel title="Responder roster">
            <ul className="grid gap-2">
              {responders.map((responder) => (
                <li key={responder.id} className="rounded-md border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{responder.displayName}</p>
                      <p className="text-muted">{responder.availability}</p>
                    </div>
                    <StatusBadge tone={responder.availability.toLowerCase().includes("available") ? "success" : "neutral"}>
                      {responder.availability}
                    </StatusBadge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button disabled={busy !== null} onClick={() => runResponderAction(responder.id, "Available")}>Available</Button>
                    <Button disabled={busy !== null} onClick={() => runResponderAction(responder.id, "Busy")}>Busy</Button>
                    <Button disabled={busy !== null} onClick={() => runResponderAction(responder.id, "OffDuty")}>Off duty</Button>
                  </div>
                </li>
              ))}
              {!responders.length ? <ConsoleEmptyState title="No responders in scope" /> : null}
            </ul>
          </Panel>

          <Panel title="Workload summary">
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">Responding now</dt><dd>{summary.responding}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Assigned awaiting response</dt><dd>{summary.assigned}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Available units</dt><dd>{summary.availableResponders}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Road ETA</dt><dd>Unavailable — haversine routing only</dd></div>
            </dl>
          </Panel>
        </div>
      </div>

      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
    </div>
  );
}
