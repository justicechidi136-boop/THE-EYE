"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "./form-primitives";
import type { AgencyView } from "../lib/types/admin-views";

type Props = {
  incidentId: string;
  currentStatus: string;
  agencies?: AgencyView[];
};

type ActionKind = "assign" | "false" | "resolve";

export function IncidentAdminActions({ incidentId, currentStatus, agencies }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [note, setNote] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<ActionKind | null>(null);

  useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus]);

  const actionCopy = action === "assign"
    ? { title: "Reassign agency", label: "Reason for reassignment", confirm: "Confirm reassignment" }
    : action === "false"
      ? { title: "Mark report false", label: "Reason", confirm: "Confirm false report" }
      : { title: "Resolve report", label: "Resolution summary", confirm: "Confirm resolution" };

  async function updateStatus(nextStatus: string) {
    setLoading("status");
    setError(null);
    try {
      const response = await fetch(`/api/admin/incidents/${incidentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, note: note.trim() || undefined }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Status update failed");
      }
      setStatus(nextStatus);
      setAction(null);
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed");
    } finally {
      setLoading(null);
    }
  }

  async function assignIncident() {
    setLoading("assign");
    setError(null);
    try {
      const response = await fetch(`/api/admin/incidents/${incidentId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyId, reason: note.trim() || undefined }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Assignment failed");
      }
      setAction(null);
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assignment failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border border-line bg-surfaceMuted p-4">
      <p className="text-sm font-semibold">Admin actions</p>
      <div className="flex flex-wrap gap-2">
        {agencies ? <Button type="button" variant="secondary" disabled={loading != null} onClick={() => { setAction("assign"); setError(null); }}>Reassign agency</Button> : null}
        <Button type="button" variant="danger" disabled={loading != null} onClick={() => { setAction("false"); setError(null); }}>Mark false</Button>
        <Button type="button" variant="secondary" disabled={loading != null} onClick={() => { setAction("resolve"); setError(null); }}>Resolve</Button>
      </div>
      <p className="text-xs text-muted">Current status: {status}</p>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
      {action ? (
        <div role="dialog" aria-modal="true" aria-labelledby="incident-action-title" onKeyDown={(event) => { if (event.key === "Escape" && loading == null) setAction(null); }} className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-soft">
            <h3 id="incident-action-title" className="text-lg font-semibold text-ink">{actionCopy.title}</h3>
            {action === "assign" ? <label className="mt-4 grid gap-2 text-sm font-medium text-ink">
              Response agency
              <select className="h-11 rounded-md border border-line bg-surface px-3 text-ink" value={agencyId} onChange={(event) => setAgencyId(event.target.value)}>
                <option value="">Select agency…</option>
                {agencies?.map((agency) => <option key={agency.id} value={agency.id}>{agency.name}</option>)}
              </select>
            </label> : null}
            <label className="mt-4 grid gap-2 text-sm font-medium text-ink">
              {actionCopy.label}
              <textarea autoFocus className="min-h-28 rounded-md border border-line bg-surface p-3 text-ink" value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            {!note.trim() ? <p className="mt-2 text-xs text-muted">This field is required.</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" disabled={loading != null} onClick={() => { setAction(null); setError(null); }}>Cancel</Button>
              <Button type="button" variant={action === "false" ? "danger" : "primary"} disabled={loading != null || !note.trim() || (action === "assign" && !agencyId)} onClick={() => action === "assign" ? assignIncident() : updateStatus(action === "false" ? "FalseReport" : "Resolved")}>
                {loading ? "Working..." : actionCopy.confirm}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
