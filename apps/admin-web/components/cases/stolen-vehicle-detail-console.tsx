"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IncidentAdminActions } from "../incident-admin-actions";
import { Button, FormField, InlineAlert, TextInput } from "../form-primitives";
import { Panel, StatusBadge } from "../ui";
import type { StolenVehicleCaseView } from "../../lib/types/admin-views";

export function StolenVehicleDetailConsole({ caseView }: { caseView: StolenVehicleCaseView }) {
  const router = useRouter();
  const [form, setForm] = useState({
    plateNumber: caseView.plateNumber,
    vin: caseView.vin ?? "",
    make: caseView.make,
    model: caseView.model,
    color: caseView.color ?? "",
    year: caseView.year?.toString() ?? "",
    lastSeenArea: caseView.lastSeenArea ?? "",
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
      const response = await fetch(`/api/admin/stolen-vehicles/${caseView.incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plateNumber: form.plateNumber.trim(),
          vin: form.vin.trim() || undefined,
          make: form.make.trim(),
          model: form.model.trim(),
          color: form.color.trim() || undefined,
          year: form.year ? Number(form.year) : undefined,
          lastSeenArea: form.lastSeenArea.trim() || undefined,
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
      <Panel title="Vehicle details">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={save}>
          <FormField label="Plate number">
            <TextInput value={form.plateNumber} onChange={(event) => setForm((current) => ({ ...current, plateNumber: event.target.value }))} required />
          </FormField>
          <FormField label="VIN">
            <TextInput value={form.vin} onChange={(event) => setForm((current) => ({ ...current, vin: event.target.value }))} />
          </FormField>
          <FormField label="Make">
            <TextInput value={form.make} onChange={(event) => setForm((current) => ({ ...current, make: event.target.value }))} required />
          </FormField>
          <FormField label="Model">
            <TextInput value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} required />
          </FormField>
          <FormField label="Color">
            <TextInput value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} />
          </FormField>
          <FormField label="Year">
            <TextInput value={form.year} onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))} />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Last seen area">
              <TextInput value={form.lastSeenArea} onChange={(event) => setForm((current) => ({ ...current, lastSeenArea: event.target.value }))} />
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField label="Report status">
              <select
                className="h-11 w-full rounded-md border border-line bg-surface px-3 py-2"
                value={form.reportStatus}
                onChange={(event) => setForm((current) => ({ ...current, reportStatus: event.target.value }))}
              >
                <option value="Open">Open</option>
                <option value="Recovered">Recovered</option>
                <option value="Closed">Closed</option>
              </select>
            </FormField>
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save case"}</Button>
          </div>
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
      </div>
    </div>
  );
}
