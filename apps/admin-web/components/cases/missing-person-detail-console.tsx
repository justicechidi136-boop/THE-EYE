"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IncidentAdminActions } from "../incident-admin-actions";
import { EvidenceGallery } from "../admin-media";
import { Button, FormField, InlineAlert, TextInput } from "../form-primitives";
import { Panel, StatusBadge } from "../ui";
import type { MissingPersonCaseView } from "../../lib/types/admin-views";

export function MissingPersonDetailConsole({ caseView }: { caseView: MissingPersonCaseView }) {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: caseView.fullName,
    age: caseView.age?.toString() ?? "",
    gender: caseView.gender ?? "",
    description: caseView.description,
    lastSeenAddress: caseView.lastSeenAddress ?? "",
    reportStatus: caseView.reportStatus,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/missing-persons/${caseView.incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          age: form.age ? Number(form.age) : undefined,
          gender: form.gender.trim() || undefined,
          description: form.description.trim(),
          lastSeenAddress: form.lastSeenAddress.trim() || undefined,
          reportStatus: form.reportStatus,
        }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Save failed");
      setMessage("Case updated.");
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      <Panel title="Missing person details">
        <form className="grid gap-4" onSubmit={save}>
          <FormField label="Full name">
            <TextInput value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} required />
          </FormField>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Age">
              <TextInput value={form.age} onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))} />
            </FormField>
            <FormField label="Gender">
              <TextInput value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))} />
            </FormField>
          </div>
          <FormField label="Last seen address">
            <TextInput value={form.lastSeenAddress} onChange={(event) => setForm((current) => ({ ...current, lastSeenAddress: event.target.value }))} />
          </FormField>
          <FormField label="Description">
            <textarea
              className="min-h-28 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              required
            />
          </FormField>
          <FormField label="Report status">
            <select
              className="h-11 w-full rounded-md border border-line bg-surface px-3 py-2"
              value={form.reportStatus}
              onChange={(event) => setForm((current) => ({ ...current, reportStatus: event.target.value }))}
            >
              <option value="Open">Open</option>
              <option value="Found">Found</option>
              <option value="Closed">Closed</option>
            </select>
          </FormField>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save case"}</Button>
        </form>
      </Panel>
      <div className="grid gap-5">
        <Panel title="Incident summary">
          <div className="grid gap-2 text-sm">
            <p><strong>Incident status:</strong> <StatusBadge tone="info">{caseView.incidentStatus}</StatusBadge></p>
            <p><strong>Priority:</strong> {caseView.priority}</p>
            <p><strong>Location:</strong> {caseView.location}</p>
            <p><strong>Created:</strong> {caseView.createdAt ? new Date(caseView.createdAt).toLocaleString() : "—"}</p>
            <p><strong>Last seen:</strong> {caseView.lastSeenAt ? new Date(caseView.lastSeenAt).toLocaleString() : "—"}</p>
          </div>
        </Panel>
        <IncidentAdminActions incidentId={caseView.incidentId} currentStatus={caseView.incidentStatus} />
        <Panel title="Persisted evidence">
          <EvidenceGallery incidentId={caseView.incidentId} items={caseView.evidence} />
        </Panel>
      </div>
    </div>
  );
}
