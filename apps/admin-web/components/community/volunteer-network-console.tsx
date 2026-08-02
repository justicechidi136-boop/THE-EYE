"use client";

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
import { Button, InlineAlert } from "../form-primitives";
import { Panel, StatusBadge } from "../ui";
import type { CommunityView, VolunteerView } from "../../lib/types/admin-views";

const VOLUNTEER_TYPES = [
  "Doctor",
  "Nurse",
  "FirstAid",
  "Lawyer",
  "SecurityVolunteer",
  "FireVolunteer",
  "SearchAndRescue",
  "BloodDonor",
] as const;

type VolunteerNetworkConsoleProps = {
  volunteers: VolunteerView[];
  communities: CommunityView[];
  filters: Record<string, string | undefined>;
};

export function VolunteerNetworkConsole({ volunteers, communities, filters }: VolunteerNetworkConsoleProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { communityId: string; verified: boolean; available: boolean; types: string[] }>>({});

  const metrics = useMemo(() => ({
    total: volunteers.length,
    verified: volunteers.filter((v) => v.status === "Verified").length,
    available: volunteers.filter((v) => v.status === "Available").length,
  }), [volunteers]);

  function editState(volunteer: VolunteerView) {
    const existing = edits[volunteer.id ?? ""];
    if (existing) return existing;
    return {
      communityId: communities.find((c) => c.name === volunteer.community)?.id ?? "",
      verified: volunteer.status === "Verified",
      available: volunteer.status === "Available" || volunteer.status === "Verified",
      types: volunteer.type.split(",").map((part) => part.trim()).filter(Boolean),
    };
  }

  async function saveVolunteer(volunteer: VolunteerView) {
    if (!volunteer.id) return;
    const state = editState(volunteer);
    setBusyId(volunteer.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/neighborhood-watch/volunteers/${volunteer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communityId: state.communityId || null,
          verified: state.verified,
          available: state.available,
          types: state.types,
          latitude: volunteer.latitude,
          longitude: volunteer.longitude,
        }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Volunteer update failed");
      setMessage(`Volunteer ${volunteer.name} updated.`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Volunteer update failed");
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
          { label: "Volunteers loaded", value: String(metrics.total) },
          { label: "Verified", value: String(metrics.verified) },
          { label: "Available", value: String(metrics.available) },
          { label: "Communities", value: String(communities.length) },
        ]}
      />
      <Panel title="Volunteer network">
        <ConsoleFilterBar>
          <ConsoleSearchInput label="Search volunteer" placeholder="Name or community" defaultValue={filters.q} name="q" />
          <ConsoleFilterSelect
            name="status"
            label="Status"
            defaultValue={filters.status ?? ""}
            options={[
              { value: "Verified", label: "Verified" },
              { value: "Available", label: "Available" },
              { value: "Unavailable", label: "Unavailable" },
            ]}
          />
        </ConsoleFilterBar>
        {volunteers.length ? (
          <ConsoleDataTable
            columns={["Volunteer", "Types", "Community", "Flags", "Actions"]}
            rows={volunteers.map((volunteer) => {
              const state = editState(volunteer);
              return [
                <div key={`name-${volunteer.id}`}>
                  <p className="font-semibold">{volunteer.name}</p>
                  <p className="text-xs text-muted">{volunteer.id?.slice(0, 8)}</p>
                </div>,
                <select
                  key={`types-${volunteer.id}`}
                  multiple
                  className="min-h-20 rounded-md border border-line bg-surface px-2 py-1 text-xs"
                  value={state.types}
                  onChange={(event) => {
                    const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
                    setEdits((current) => ({ ...current, [volunteer.id ?? ""]: { ...state, types: selected } }));
                  }}
                >
                  {VOLUNTEER_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>,
                <select
                  key={`community-${volunteer.id}`}
                  className="rounded-md border border-line bg-surface px-2 py-1 text-xs"
                  value={state.communityId}
                  onChange={(event) => setEdits((current) => ({ ...current, [volunteer.id ?? ""]: { ...state, communityId: event.target.value } }))}
                >
                  <option value="">Unassigned</option>
                  {communities.map((community) => (
                    <option key={community.id} value={community.id}>{community.name}</option>
                  ))}
                </select>,
                <div key={`flags-${volunteer.id}`} className="grid gap-1 text-xs">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={state.verified} onChange={(event) => setEdits((current) => ({ ...current, [volunteer.id ?? ""]: { ...state, verified: event.target.checked } }))} />
                    Verified
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={state.available} onChange={(event) => setEdits((current) => ({ ...current, [volunteer.id ?? ""]: { ...state, available: event.target.checked } }))} />
                    Available
                  </label>
                  <StatusBadge tone={volunteer.status === "Verified" ? "success" : "neutral"}>{volunteer.status}</StatusBadge>
                </div>,
                <Button type="button" variant="primary" disabled={busyId === volunteer.id} onClick={() => saveVolunteer(volunteer)}>Save</Button>,
              ];
            })}
          />
        ) : (
          <ConsoleEmptyState title="No volunteers in scope" detail="Volunteers appear when registered in assigned communities." />
        )}
      </Panel>
    </div>
  );
}
