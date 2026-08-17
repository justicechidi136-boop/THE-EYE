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
import { EvidencePicker, uploadIncidentEvidence, type SelectedEvidenceFile } from "../admin-media";
import { Panel, StatusBadge } from "../ui";
import type { MissingPersonCaseView } from "../../lib/types/admin-views";

type MissingPersonConsoleProps = {
  cases: MissingPersonCaseView[];
  hasMore: boolean;
  nextCursor?: string;
  filters: Record<string, string | undefined>;
};

export function MissingPersonConsole({ cases, hasMore, nextCursor, filters }: MissingPersonConsoleProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<SelectedEvidenceFile[]>([]);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    age: "",
    gender: "",
    description: "",
    lastSeenAddress: "",
    latitude: "",
    longitude: "",
  });

  const metrics = useMemo(() => ({
    total: cases.length,
    open: cases.filter((item) => item.reportStatus === "Open").length,
    active: cases.filter((item) => !["Closed", "Found"].includes(item.reportStatus)).length,
    verifying: cases.filter((item) => item.incidentStatus === "Verifying").length,
  }), [cases]);

  async function createCase(event: React.FormEvent) {
    event.preventDefault();
    setBusyId("create");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/missing-persons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Missing person: ${createForm.fullName.trim()}`,
          description: createForm.description.trim() || "Missing person report",
          latitude: createForm.latitude ? Number(createForm.latitude) : undefined,
          longitude: createForm.longitude ? Number(createForm.longitude) : undefined,
          manualAddress: createForm.lastSeenAddress.trim() || undefined,
          missingPerson: {
            fullName: createForm.fullName.trim(),
            age: createForm.age ? Number(createForm.age) : undefined,
            gender: createForm.gender.trim() || undefined,
            description: createForm.description.trim() || "Missing person report",
            lastSeenAddress: createForm.lastSeenAddress.trim() || undefined,
          },
        }),
      });
      const payload = (await response.json()) as { message?: string; data?: { incident?: { id?: string } } };
      if (!response.ok) throw new Error(payload.message ?? "Case creation failed");
      const incidentId = payload.data?.incident?.id;
      if (!incidentId) throw new Error("Case was created but no incident ID was returned.");
      if (evidenceFiles.length) {
        await uploadIncidentEvidence(incidentId, evidenceFiles);
      }
      setMessage(evidenceFiles.length ? "Missing person case and evidence created." : "Missing person case created.");
      setCreateForm({ fullName: "", age: "", gender: "", description: "", lastSeenAddress: "", latitude: "", longitude: "" });
      evidenceFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setEvidenceFiles([]);
      if (incidentId) router.push(`/missing-persons/${incidentId}`);
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
      const response = await fetch(`/api/admin/missing-persons/${incidentId}`, {
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
    ? `/missing-persons?${new URLSearchParams({ ...filters, cursor: nextCursor }).toString()}`
    : undefined;

  return (
    <div className="grid gap-5">
      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      <ConsoleMetrics
        items={[
          { label: "Loaded cases", value: String(metrics.total) },
          { label: "Open reports", value: String(metrics.open) },
          { label: "Active cases", value: String(metrics.active) },
          { label: "Verifying", value: String(metrics.verifying) },
        ]}
      />
      <Panel title="Register missing person">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={createCase}>
          <FormField label="Full name">
            <TextInput value={createForm.fullName} onChange={(event) => setCreateForm((current) => ({ ...current, fullName: event.target.value }))} required />
          </FormField>
          <FormField label="Age">
            <TextInput value={createForm.age} onChange={(event) => setCreateForm((current) => ({ ...current, age: event.target.value }))} />
          </FormField>
          <FormField label="Gender">
            <TextInput value={createForm.gender} onChange={(event) => setCreateForm((current) => ({ ...current, gender: event.target.value }))} />
          </FormField>
          <FormField label="Last seen address">
            <TextInput value={createForm.lastSeenAddress} onChange={(event) => setCreateForm((current) => ({ ...current, lastSeenAddress: event.target.value }))} />
          </FormField>
          <FormField label="Latitude">
            <TextInput value={createForm.latitude} onChange={(event) => setCreateForm((current) => ({ ...current, latitude: event.target.value }))} />
          </FormField>
          <FormField label="Longitude">
            <TextInput value={createForm.longitude} onChange={(event) => setCreateForm((current) => ({ ...current, longitude: event.target.value }))} />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Description">
              <textarea
                className="min-h-24 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
                value={createForm.description}
                onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
                required
              />
            </FormField>
          </div>
          <EvidencePicker
            label="Evidence attachments"
            allowedTypes={["Image", "Audio"]}
            files={evidenceFiles}
            onChange={setEvidenceFiles}
            disabled={busyId === "create"}
          />
          <div className="md:col-span-2">
            <Button type="submit" disabled={busyId === "create"}>{busyId === "create" ? "Creating and uploading..." : "Create case"}</Button>
          </div>
        </form>
      </Panel>
      <Panel title="Missing person cases">
        <ConsoleFilterBar>
          <ConsoleSearchInput label="Search" placeholder="Name or description" defaultValue={filters.q} name="q" />
          <ConsoleFilterSelect
            name="reportStatus"
            label="Report status"
            defaultValue={filters.reportStatus}
            options={[
              { value: "Open", label: "Open" },
              { value: "Found", label: "Found" },
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
            columns={["Person", "Last seen", "Report", "Incident", "Priority", "Actions"]}
            rows={cases.map((item) => [
              <div key={`name-${item.incidentId}`}>
                <Link href={`/missing-persons/${item.incidentId}`} className="font-semibold text-eye hover:underline">{item.fullName}</Link>
                <p className="text-xs text-muted">{item.incidentId.slice(0, 8)}</p>
              </div>,
              item.lastSeenAddress ?? item.location,
              <StatusBadge key={`report-${item.incidentId}`} tone={item.reportStatus === "Open" ? "warning" : item.reportStatus === "Found" ? "success" : "neutral"}>{item.reportStatus}</StatusBadge>,
              item.incidentStatus,
              item.priority,
              <div key={`actions-${item.incidentId}`} className="flex flex-wrap gap-2">
                {item.reportStatus !== "Found" ? (
                  <Button type="button" variant="primary" disabled={busyId === item.incidentId} onClick={() => updateReportStatus(item.incidentId, "Found")}>Mark found</Button>
                ) : null}
                {item.reportStatus !== "Closed" ? (
                  <Button type="button" variant="secondary" disabled={busyId === item.incidentId} onClick={() => updateReportStatus(item.incidentId, "Closed")}>Close</Button>
                ) : null}
                <Link href={`/incidents/${item.incidentId}`} className="text-xs font-semibold text-eye hover:underline">Incident</Link>
              </div>,
            ])}
          />
        ) : (
          <ConsoleEmptyState title="No missing person cases in scope" detail="Adjust filters or register a new case." />
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
