"use client";

import { useState } from "react";
import type { DuplicateReportView, EvidenceAccessEntry } from "../lib/types/admin-views";
import { PLACEHOLDER_DEPENDENCIES } from "../lib/placeholder-dependencies";
import { verificationStatusFromScore, verificationStatusTone, type VerificationStatus } from "../lib/verification";
import { Button } from "./form-primitives";
import { PlaceholderNotice } from "./placeholder-notice";
import { StatusBadge } from "./ui";

export function VerificationStatusBadge({ score, status }: { score: number; status?: string }) {
  const label = verificationStatusFromScore(score, status);
  return <StatusBadge tone={verificationStatusTone(label)}>{label}</StatusBadge>;
}

export function DuplicateReportPanel({ incidentId }: { incidentId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateReportView[]>([]);

  async function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    if (next && !duplicates.length && !loading) {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/verification/incidents/${incidentId}/duplicates`);
        const payload = (await response.json()) as { data?: DuplicateReportView[]; message?: string };
        if (!response.ok) throw new Error(payload.message ?? "Unable to load duplicate reports");
        setDuplicates(payload.data ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load duplicate reports");
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="rounded-lg border border-line bg-surfaceMuted p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Duplicate report detection</p>
          <p className="text-sm text-muted">Nearby reports within 120m of {incidentId}</p>
        </div>
        <Button variant="secondary" onClick={toggleExpanded}>
          {expanded ? "Hide cluster" : "View cluster"}
        </Button>
      </div>
      {expanded ? (
        <div className="mt-3 grid gap-2">
          {loading ? <p className="text-sm text-muted">Loading duplicate cluster…</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {duplicates.length ? duplicates.map((item) => (
            <div key={item.id} className="rounded-md border border-line bg-surface p-3 text-sm">
              <p className="font-semibold">{item.id} — {item.title}</p>
              <p className="text-muted">{item.distance} away • {item.confidence}% confidence</p>
            </div>
          )) : !loading && !error ? <p className="text-sm text-muted">No nearby duplicate reports returned by the API.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function WitnessConfirmationPanel({ incidentId }: { incidentId: string }) {
  const dependency = PLACEHOLDER_DEPENDENCIES.witnessConfirmations;
  return (
    <div className="rounded-lg border border-line bg-surfaceMuted p-4">
      <p className="font-semibold">Nearby witness confirmation</p>
      <p className="text-sm text-muted">Crowd signals for {incidentId}</p>
      <div className="mt-3 grid gap-2">
        <p className="text-sm text-muted">No witness confirmations are exposed by the API yet.</p>
      </div>
      <div className="mt-3 flex gap-2">
        <Button disabled>Request crowd confirmation</Button>
        <Button variant="secondary" disabled>Mark witness verified</Button>
      </div>
      <div className="mt-3">
        <PlaceholderNotice title={dependency.title} endpoint={dependency.endpoint} note={dependency.note} />
      </div>
    </div>
  );
}

export function EvidenceAccessLog({ entries }: { entries: EvidenceAccessEntry[] }) {
  return (
    <div className="grid gap-2">
      {entries.length ? entries.map((entry) => (
        <div key={`${entry.actor}-${entry.file}-${entry.time}`} className="rounded-md border border-line bg-surfaceMuted p-3 text-sm">
          <p className="font-semibold">{entry.actor} — {entry.action}</p>
          <p className="text-muted">{entry.file} • {entry.time}</p>
        </div>
      )) : <p className="text-sm text-muted">No evidence access events recorded for this incident.</p>}
    </div>
  );
}

export function StatusHistoryPanel({ statuses }: { statuses: VerificationStatus[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((status) => (
        <VerificationStatusBadge key={status} score={status === "Verified" ? 90 : status === "Pending" ? 60 : 30} status={status} />
      ))}
    </div>
  );
}
