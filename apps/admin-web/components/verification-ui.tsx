"use client";

import { useState } from "react";
import type { DuplicateReportView, EvidenceAccessEntry, WitnessConfirmationView } from "../lib/types/admin-views";
import { Button } from "./form-primitives";
import { StatusBadge } from "./ui";

export function VerificationStatusBadge({ score, status }: { score: number; status?: string }) {
  const label = status ?? (score >= 80 ? "Verified" : score >= 60 ? "Pending" : "Low confidence");
  const tone = label === "Verified" || label === "confirmed" ? "success" : label === "Pending" ? "warning" : "danger";
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
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
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmations, setConfirmations] = useState<WitnessConfirmationView[]>([]);

  async function loadConfirmations() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/verification/incidents/${incidentId}/confirmations`);
      const payload = (await response.json()) as { data?: WitnessConfirmationView[]; message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Unable to load witness confirmations");
      setConfirmations(payload.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load witness confirmations");
    } finally {
      setLoading(false);
    }
  }

  async function requestCrowdConfirmation() {
    setRequesting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/verification/incidents/${incidentId}/crowd-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ radiusMeters: 500, limit: 25 }),
      });
      const payload = (await response.json()) as { requested?: number; message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Unable to request crowd confirmation");
      setMessage(`Crowd confirmation requested from ${payload.requested ?? 0} nearby user(s).`);
      await loadConfirmations();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to request crowd confirmation");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-surfaceMuted p-4">
      <p className="font-semibold">Nearby witness confirmation</p>
      <p className="text-sm text-muted">Crowd signals for {incidentId}</p>
      <div className="mt-3 flex gap-2">
        <Button disabled={requesting} onClick={requestCrowdConfirmation}>
          {requesting ? "Requesting…" : "Request crowd confirmation"}
        </Button>
        <Button variant="secondary" disabled={loading} onClick={loadConfirmations}>
          {loading ? "Loading…" : "Refresh confirmations"}
        </Button>
      </div>
      {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-3 grid gap-2">
        {confirmations.length ? confirmations.map((item) => (
          <div key={item.id} className="rounded-md border border-line bg-surface p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{item.verifierName}</p>
              <VerificationStatusBadge score={item.confidence ?? 50} status={item.result} />
            </div>
            <p className="text-muted">{item.method} • {item.createdAt}</p>
            {item.notes ? <p className="mt-1">{item.notes}</p> : null}
          </div>
        )) : !loading && !error ? <p className="text-sm text-muted">No witness confirmations loaded yet.</p> : null}
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

export function StatusHistoryPanel({ statuses }: { statuses: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((status) => (
        <VerificationStatusBadge key={status} score={status === "Verified" ? 90 : status === "Pending" ? 60 : 30} status={status} />
      ))}
    </div>
  );
}
