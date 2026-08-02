"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ConsoleDataTable,
  ConsoleEmptyState,
  ConsoleFilterBar,
  ConsoleFilterSelect,
  ConsoleMetrics,
  ConsoleSearchInput,
} from "../console";
import { Button, FormField, InlineAlert, TextInput } from "../form-primitives";
import { Panel, StatusBadge } from "../ui";
import type { StolenVehicleCaseView } from "../../lib/types/admin-views";

type StolenVehicleConsoleProps = {
  cases: StolenVehicleCaseView[];
  hasMore: boolean;
  nextCursor?: string;
  filters: Record<string, string | undefined>;
};

export function StolenVehicleConsole({ cases, hasMore, nextCursor, filters }: StolenVehicleConsoleProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    plateNumber: "",
    vin: "",
    make: "",
    model: "",
    color: "",
    year: "",
    lastSeenArea: "",
    latitude: "",
    longitude: "",
  });

  const metrics = useMemo(() => ({
    total: cases.length,
    open: cases.filter((item) => item.reportStatus === "Open").length,
    watchlisted: cases.filter((item) => !["Closed", "Recovered"].includes(item.reportStatus)).length,
    verifying: cases.filter((item) => item.incidentStatus === "Verifying").length,
  }), [cases]);

  async function createCase(event: React.FormEvent) {
    event.preventDefault();
    setBusyId("create");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/stolen-vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Stolen vehicle: ${createForm.plateNumber.trim()}`,
          description: `Stolen vehicle report for ${createForm.plateNumber.trim()}`,
          latitude: createForm.latitude ? Number(createForm.latitude) : undefined,
          longitude: createForm.longitude ? Number(createForm.longitude) : undefined,
          manualAddress: createForm.lastSeenArea.trim() || undefined,
          stolenVehicle: {
            plateNumber: createForm.plateNumber.trim(),
            vin: createForm.vin.trim() || undefined,
            make: createForm.make.trim(),
            model: createForm.model.trim(),
            color: createForm.color.trim() || undefined,
            year: createForm.year ? Number(createForm.year) : undefined,
            lastSeenArea: createForm.lastSeenArea.trim() || undefined,
          },
        }),
      });
      const payload = (await response.json()) as { message?: string; data?: { incident?: { id?: string } } };
      if (!response.ok) throw new Error(payload.message ?? "Case creation failed");
      setMessage("Stolen vehicle case created.");
      setCreateForm({ plateNumber: "", vin: "", make: "", model: "", color: "", year: "", lastSeenArea: "", latitude: "", longitude: "" });
      const incidentId = payload.data?.incident?.id;
      if (incidentId) router.push(`/stolen-vehicles/${incidentId}`);
      else router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Case creation failed");
    } finally {
      setBusyId(null);
    }
  }

  async function updateReportStatus(incidentId: string, reportStatus: string) {
    setBusyId(incidentId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/stolen-vehicles/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportStatus }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Status update failed");
      setMessage(`Case marked ${reportStatus.toLowerCase()}.`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Status update failed");
    } finally {
      setBusyId(null);
    }
  }

  const nextHref = hasMore && nextCursor
    ? `/stolen-vehicles?${new URLSearchParams({ ...filters, cursor: nextCursor }).toString()}`
    : undefined;

  return (
    <div className="grid gap-5">
      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      <ConsoleMetrics
        items={[
          { label: "Loaded cases", value: String(metrics.total) },
          { label: "Open reports", value: String(metrics.open) },
          { label: "Watchlisted", value: String(metrics.watchlisted) },
          { label: "Verifying", value: String(metrics.verifying) },
        ]}
      />
      <Panel title="Register stolen vehicle">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={createCase}>
          <FormField label="Plate number">
            <TextInput value={createForm.plateNumber} onChange={(event) => setCreateForm((current) => ({ ...current, plateNumber: event.target.value }))} required />
          </FormField>
          <FormField label="VIN">
            <TextInput value={createForm.vin} onChange={(event) => setCreateForm((current) => ({ ...current, vin: event.target.value }))} />
          </FormField>
          <FormField label="Make">
            <TextInput value={createForm.make} onChange={(event) => setCreateForm((current) => ({ ...current, make: event.target.value }))} required />
          </FormField>
          <FormField label="Model">
            <TextInput value={createForm.model} onChange={(event) => setCreateForm((current) => ({ ...current, model: event.target.value }))} required />
          </FormField>
          <FormField label="Color">
            <TextInput value={createForm.color} onChange={(event) => setCreateForm((current) => ({ ...current, color: event.target.value }))} />
          </FormField>
          <FormField label="Year">
            <TextInput value={createForm.year} onChange={(event) => setCreateForm((current) => ({ ...current, year: event.target.value }))} />
          </FormField>
          <FormField label="Last seen area">
            <TextInput value={createForm.lastSeenArea} onChange={(event) => setCreateForm((current) => ({ ...current, lastSeenArea: event.target.value }))} />
          </FormField>
          <FormField label="Latitude">
            <TextInput value={createForm.latitude} onChange={(event) => setCreateForm((current) => ({ ...current, latitude: event.target.value }))} />
          </FormField>
          <FormField label="Longitude">
            <TextInput value={createForm.longitude} onChange={(event) => setCreateForm((current) => ({ ...current, longitude: event.target.value }))} />
          </FormField>
          <div className="md:col-span-2">
            <Button type="submit" disabled={busyId === "create"}>{busyId === "create" ? "Creating…" : "Create case"}</Button>
          </div>
        </form>
      </Panel>
      <Panel title="Stolen vehicle cases">
        <ConsoleFilterBar>
          <ConsoleSearchInput label="Search" placeholder="Plate, VIN, make, or model" defaultValue={filters.q} name="q" />
          <ConsoleFilterSelect
            name="reportStatus"
            label="Report status"
            defaultValue={filters.reportStatus}
            options={[
              { value: "Open", label: "Open" },
              { value: "Recovered", label: "Recovered" },
              { value: "Closed", label: "Closed" },
            ]}
          />
          <ConsoleFilterSelect
            name="status"
            label="Incident status"
            defaultValue={filters.status}
            options={[
              { value: "Submitted", label: "Submitted" },
              { value: "Received", label: "Received" },
              { value: "Verifying", label: "Verifying" },
              { value: "Verified", label: "Verified" },
              { value: "Assigned", label: "Assigned" },
              { value: "Responding", label: "Responding" },
              { value: "Resolved", label: "Resolved" },
              { value: "Closed", label: "Closed" },
            ]}
          />
        </ConsoleFilterBar>
        {cases.length ? (
          <ConsoleDataTable
            columns={["Vehicle", "Plate", "Last seen", "Report", "Incident", "Actions"]}
            rows={cases.map((item) => [
              <div key={`vehicle-${item.incidentId}`}>
                <Link href={`/stolen-vehicles/${item.incidentId}`} className="font-semibold text-eye hover:underline">{item.make} {item.model}</Link>
                <p className="text-xs text-muted">{item.color ?? "Unknown color"} · {item.year ?? "—"}</p>
              </div>,
              item.plateNumber,
              item.lastSeenArea ?? item.location,
              <StatusBadge key={`report-${item.incidentId}`} tone={item.reportStatus === "Open" ? "warning" : item.reportStatus === "Recovered" ? "success" : "neutral"}>{item.reportStatus}</StatusBadge>,
              item.incidentStatus,
              <div key={`actions-${item.incidentId}`} className="flex flex-wrap gap-2">
                {item.reportStatus !== "Recovered" ? (
                  <Button type="button" variant="primary" disabled={busyId === item.incidentId} onClick={() => updateReportStatus(item.incidentId, "Recovered")}>Recovered</Button>
                ) : null}
                {item.reportStatus !== "Closed" ? (
                  <Button type="button" variant="secondary" disabled={busyId === item.incidentId} onClick={() => updateReportStatus(item.incidentId, "Closed")}>Close</Button>
                ) : null}
                <Link href={`/incidents/${item.incidentId}`} className="text-xs font-semibold text-eye hover:underline">Incident</Link>
              </div>,
            ])}
          />
        ) : (
          <ConsoleEmptyState title="No stolen vehicle cases in scope" detail="Adjust filters or register a new case." />
        )}
        {nextHref ? (
          <div className="mt-4">
            <Link href={nextHref} className="text-sm font-semibold text-eye hover:underline">Load more cases →</Link>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
