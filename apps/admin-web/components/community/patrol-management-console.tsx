"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ConsoleDataTable,
  ConsoleEmptyState,
  ConsoleMetrics,
} from "../console";
import { Button, FormField, InlineAlert, TextInput } from "../form-primitives";
import { Panel, StatusBadge } from "../ui";
import type { CommunityView, PatrolScheduleView } from "../../lib/types/admin-views";

type PatrolManagementConsoleProps = {
  patrols: PatrolScheduleView[];
  communities: CommunityView[];
};

export function PatrolManagementConsole({ patrols, communities }: PatrolManagementConsoleProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    communityId: communities[0]?.id ?? "",
    title: "",
    startsAt: "",
    endsAt: "",
  });

  const metrics = useMemo(() => ({
    total: patrols.length,
    active: patrols.filter((p) => p.status === "Active").length,
    scheduled: patrols.filter((p) => p.status === "Scheduled").length,
    completed: patrols.filter((p) => p.status === "Completed").length,
  }), [patrols]);

  async function updatePatrol(patrolId: string, payload: Record<string, unknown>) {
    setBusyId(patrolId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/neighborhood-watch/patrols/${patrolId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Patrol update failed");
      setMessage("Patrol schedule updated.");
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Patrol update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function createPatrol(event: React.FormEvent) {
    event.preventDefault();
    setBusyId("create");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/neighborhood-watch/patrols", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Patrol creation failed");
      setMessage("Patrol schedule created.");
      setCreateForm((current) => ({ ...current, title: "", startsAt: "", endsAt: "" }));
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Patrol creation failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-5">
      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      <ConsoleMetrics
        items={[
          { label: "Schedules", value: String(metrics.total) },
          { label: "Active", value: String(metrics.active) },
          { label: "Scheduled", value: String(metrics.scheduled) },
          { label: "Completed", value: String(metrics.completed) },
        ]}
      />
      <Panel title="Create patrol schedule">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={createPatrol}>
          <label className="grid gap-1 text-sm md:col-span-2">
            <span className="font-medium text-ink">Community</span>
            <select
              className="rounded-md border border-line bg-surface px-3 py-2"
              value={createForm.communityId}
              onChange={(event) => setCreateForm((current) => ({ ...current, communityId: event.target.value }))}
              required
            >
              {communities.map((community) => (
                <option key={community.id} value={community.id}>{community.name}</option>
              ))}
            </select>
          </label>
          <FormField label="Title">
            <TextInput value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} required />
          </FormField>
          <FormField label="Starts at (ISO)">
            <TextInput value={createForm.startsAt} onChange={(event) => setCreateForm((current) => ({ ...current, startsAt: event.target.value }))} placeholder="2026-08-02T18:00:00.000Z" required />
          </FormField>
          <FormField label="Ends at (ISO)">
            <TextInput value={createForm.endsAt} onChange={(event) => setCreateForm((current) => ({ ...current, endsAt: event.target.value }))} placeholder="2026-08-02T22:00:00.000Z" required />
          </FormField>
          <div className="md:col-span-2">
            <Button type="submit" disabled={busyId === "create"}>{busyId === "create" ? "Creating…" : "Create patrol"}</Button>
          </div>
        </form>
      </Panel>
      <Panel title="Patrol schedules">
        {patrols.length ? (
          <ConsoleDataTable
            columns={["Patrol", "Community", "Window", "Status", "Volunteers", "Actions"]}
            rows={patrols.map((patrol) => [
              <Link key={`title-${patrol.id}`} href={`/neighborhood-watch/patrols/${patrol.id}`} className="font-semibold text-eye hover:underline">{patrol.title}</Link>,
              patrol.community,
              `${patrol.startsAt ? new Date(patrol.startsAt).toLocaleString() : "—"} → ${patrol.endsAt ? new Date(patrol.endsAt).toLocaleString() : "—"}`,
              <StatusBadge key={`status-${patrol.id}`} tone={patrol.status === "Active" ? "success" : "info"}>{patrol.status}</StatusBadge>,
              String(patrol.volunteers),
              <div key={`actions-${patrol.id}`} className="flex flex-wrap gap-2">
                {patrol.status !== "Active" ? (
                  <Button type="button" variant="primary" disabled={busyId === patrol.id} onClick={() => updatePatrol(patrol.id, { status: "Active" })}>Activate</Button>
                ) : null}
                {patrol.status !== "Completed" ? (
                  <Button type="button" variant="secondary" disabled={busyId === patrol.id} onClick={() => updatePatrol(patrol.id, { status: "Completed" })}>Complete</Button>
                ) : null}
                {patrol.status !== "Cancelled" ? (
                  <Button type="button" variant="danger" disabled={busyId === patrol.id} onClick={() => updatePatrol(patrol.id, { status: "Cancelled" })}>Cancel</Button>
                ) : null}
              </div>,
            ])}
          />
        ) : (
          <ConsoleEmptyState title="No patrol schedules" detail="Create a patrol schedule for an assigned community." />
        )}
      </Panel>
    </div>
  );
}
