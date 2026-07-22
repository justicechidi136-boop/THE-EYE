"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./form-primitives";

type Props = {
  incidentId: string;
  currentStatus: string;
};

export function IncidentAdminActions({ incidentId, currentStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [note, setNote] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({ agencyId: agencyId.trim() || undefined, reason: note.trim() || undefined }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Assignment failed");
      }
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
      <input
        className="rounded border border-line bg-surface px-2 py-1 text-sm"
        placeholder="Note or assignment reason"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <input
        className="rounded border border-line bg-surface px-2 py-1 text-sm"
        placeholder="Agency ID (optional)"
        value={agencyId}
        onChange={(event) => setAgencyId(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={loading != null} onClick={() => updateStatus("Received")}>
          {loading === "status" ? "..." : "Mark received"}
        </Button>
        <Button type="button" variant="secondary" disabled={loading != null} onClick={() => updateStatus("Responding")}>
          Mark responding
        </Button>
        <Button type="button" variant="secondary" disabled={loading != null} onClick={() => updateStatus("Resolved")}>
          Resolve
        </Button>
        <Button type="button" variant="danger" disabled={loading != null} onClick={() => updateStatus("FalseReport")}>
          Mark false
        </Button>
        <Button type="button" variant="secondary" disabled={loading != null} onClick={assignIncident}>
          {loading === "assign" ? "..." : "Assign agency"}
        </Button>
      </div>
      <p className="text-xs text-muted">Current status: {status}</p>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
}
