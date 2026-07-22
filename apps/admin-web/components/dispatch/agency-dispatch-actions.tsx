"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button, InlineAlert } from "../form-primitives";
import { Panel } from "../ui";
import { type DispatchIncident, type DispatchResponder } from "../../lib/api/dispatch";

type AgencyDispatchActionsProps = {
  incidents: DispatchIncident[];
  responders: DispatchResponder[];
};

export function AgencyDispatchActions({ incidents, responders }: AgencyDispatchActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runResponderAction(responderId: string, availability: string) {
    setBusy(responderId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/dispatch/responders/${responderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability, note: "Updated from agency dashboard" }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Availability update failed");
      setMessage(`Responder ${responderId} set to ${availability}.`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Availability update failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Assigned incidents">
        <ul className="space-y-2">
          {incidents.map((incident) => (
            <li key={incident.id} className="rounded-md border p-3 text-sm">
              <div className="font-medium">{incident.title}</div>
              <div>{incident.status} · {incident.priority}</div>
              <Link className="text-primary underline" href={`/dispatch/incidents/${incident.id}`}>
                Open incident detail
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Responder availability">
        <ul className="space-y-2">
          {responders.map((responder) => (
            <li key={responder.id} className="rounded-md border p-3 text-sm">
              <div className="font-medium">{responder.displayName}</div>
              <div className="mb-2">{responder.availability}</div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy !== null} onClick={() => runResponderAction(responder.id, "Available")}>Available</Button>
                <Button disabled={busy !== null} onClick={() => runResponderAction(responder.id, "Busy")}>Busy</Button>
                <Button disabled={busy !== null} onClick={() => runResponderAction(responder.id, "OffDuty")}>Off duty</Button>
              </div>
            </li>
          ))}
        </ul>
        {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      </Panel>
    </div>
  );
}
