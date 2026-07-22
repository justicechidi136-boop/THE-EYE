"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, InlineAlert } from "../form-primitives";

type DispatchActionsProps = {
  incidentId: string;
  responders: Array<{ id: string; displayName: string; agencyId: string }>;
  assignmentVersion?: number | null;
};

export function DispatchActions({ incidentId, responders, assignmentVersion }: DispatchActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responderId, setResponderId] = useState(responders[0]?.id ?? "");
  const [agencyId, setAgencyId] = useState(responders[0]?.agencyId ?? "");
  const [priority, setPriority] = useState("P1LifeThreatening");
  const [reason, setReason] = useState("");

  async function runAction(action: string, body?: Record<string, unknown>) {
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/dispatch/incidents/${incidentId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const payload = (await response.json()) as { message?: string; ok?: boolean };
      if (!response.ok) throw new Error(payload.message ?? `${action} failed`);
      setMessage(`${action} completed.`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `${action} failed`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Responder
          <select
            className="rounded-md border px-2 py-2"
            value={responderId}
            onChange={(event) => {
              const next = responders.find((item) => item.id === event.target.value);
              setResponderId(event.target.value);
              if (next) setAgencyId(next.agencyId);
            }}
          >
            {responders.map((responder) => (
              <option key={responder.id} value={responder.id}>
                {responder.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Priority override
          <select className="rounded-md border px-2 py-2" value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="P1LifeThreatening">P1 Life threatening</option>
            <option value="P2Urgent">P2 Urgent</option>
            <option value="P3Standard">P3 Standard</option>
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-sm">
        Reason / note
        <textarea
          className="min-h-20 rounded-md border px-2 py-2"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Required for triage changes, escalation, and info requests"
        />
      </label>
      {assignmentVersion ? <p className="text-xs text-muted-foreground">Assignment version: {assignmentVersion}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy !== null || !responderId || !agencyId}
          onClick={() =>
            runAction("assign", {
              agencyId,
              responderId,
              reason: reason || "Assigned from command center",
              clientAssignmentId: crypto.randomUUID(),
            })
          }
        >
          Assign
        </Button>
        <Button
          disabled={busy !== null || !responderId || !agencyId}
          onClick={() =>
            runAction("reassign", {
              agencyId,
              responderId,
              reason: reason || "Reassigned from command center",
              clientAssignmentId: crypto.randomUUID(),
            })
          }
        >
          Reassign
        </Button>
        <Button disabled={busy !== null} variant="danger" onClick={() => runAction("escalate", { reason: reason || "Manual escalation from command center" })}>
          Escalate (manual)
        </Button>
        <Button disabled={busy !== null} onClick={() => runAction("request-info", { reason: reason || "Dispatcher requested more information" })}>
          Request info
        </Button>
        <Button
          disabled={busy !== null}
          onClick={() =>
            runAction("triage", {
              priority,
              reason: reason || "Priority updated from command center",
            })
          }
        >
          Update triage
        </Button>
      </div>
      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
    </div>
  );
}
