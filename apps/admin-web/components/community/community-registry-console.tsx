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
import { Button, InlineAlert } from "../form-primitives";
import { Panel, StatusBadge } from "../ui";
import type { CommunityView } from "../../lib/types/admin-views";

type CommunityRegistryConsoleProps = {
  communities: CommunityView[];
  hasMore: boolean;
  nextCursor?: string;
  filters: Record<string, string | undefined>;
};

function statusTone(status?: string): "success" | "warning" | "neutral" | "info" {
  if (status === "Active") return "success";
  if (status === "Suspended") return "warning";
  if (status === "Archived") return "neutral";
  return "info";
}

export function CommunityRegistryConsole({
  communities,
  hasMore,
  nextCursor,
  filters,
}: CommunityRegistryConsoleProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const metrics = useMemo(() => ({
    total: communities.length,
    active: communities.filter((c) => c.status === "Active" || !c.status).length,
    pending: communities.reduce((sum, c) => sum + c.pending, 0),
    suspended: communities.filter((c) => c.status === "Suspended").length,
  }), [communities]);

  async function updateStatus(communityId: string, status: "Active" | "Suspended" | "Archived") {
    setBusyId(communityId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/neighborhood-watch/communities/${communityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Status update failed");
      setMessage(`Community marked ${status.toLowerCase()}.`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Status update failed");
    } finally {
      setBusyId(null);
    }
  }

  const nextHref = hasMore && nextCursor
    ? `/neighborhood-watch/communities?${new URLSearchParams({ ...filters, cursor: nextCursor }).toString()}`
    : undefined;

  return (
    <div className="grid gap-5">
      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      <ConsoleMetrics
        items={[
          { label: "Loaded communities", value: String(metrics.total) },
          { label: "Active", value: String(metrics.active) },
          { label: "Pending approvals", value: String(metrics.pending) },
          { label: "Suspended", value: String(metrics.suspended) },
        ]}
      />
      <Panel
        title="Community registry"
        aside={
          <Link href="/neighborhood-watch/communities/new" className="text-sm font-semibold text-eye hover:underline">
            Create community →
          </Link>
        }
      >
        <div className="mb-4 grid gap-4">
          <ConsoleFilterBar>
            <ConsoleSearchInput label="Search" placeholder="Name, estate, or ward" defaultValue={filters.search} />
            <ConsoleFilterSelect
              name="status"
              label="Status"
              defaultValue={filters.status ?? "all"}
              options={[
                { value: "all", label: "All statuses" },
                { value: "Active", label: "Active" },
                { value: "Suspended", label: "Suspended" },
                { value: "Archived", label: "Archived" },
              ]}
            />
          </ConsoleFilterBar>
        </div>
        {communities.length ? (
          <ConsoleDataTable
            columns={["Community", "Hierarchy", "Members", "Pending", "Status", "Actions"]}
            rows={communities.map((community) => [
              <div key={`name-${community.id}`}>
                <Link href={`/neighborhood-watch/communities/${community.id}`} className="font-semibold text-eye hover:underline">
                  {community.name}
                </Link>
                <p className="text-xs text-muted">{community.level} · {community.visibility}</p>
              </div>,
              community.hierarchy,
              String(community.members),
              String(community.pending),
              <StatusBadge key={`status-${community.id}`} tone={statusTone(community.status)}>{community.status ?? "Active"}</StatusBadge>,
              <div key={`actions-${community.id}`} className="flex flex-wrap gap-2">
                <Link href={`/neighborhood-watch/communities/${community.id}/edit`} className="text-xs font-semibold text-eye hover:underline">Edit</Link>
                {community.status !== "Suspended" ? (
                  <Button type="button" variant="secondary" disabled={busyId === community.id} onClick={() => updateStatus(community.id, "Suspended")}>
                    Suspend
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" disabled={busyId === community.id} onClick={() => updateStatus(community.id, "Active")}>
                    Restore
                  </Button>
                )}
                {community.status !== "Archived" ? (
                  <Button type="button" variant="danger" disabled={busyId === community.id} onClick={() => updateStatus(community.id, "Archived")}>
                    Archive
                  </Button>
                ) : null}
              </div>,
            ])}
          />
        ) : (
          <ConsoleEmptyState title="No communities in scope" detail="Adjust filters or create a new community." />
        )}
        {nextHref ? (
          <div className="mt-4">
            <Link href={nextHref} className="text-sm font-semibold text-eye hover:underline">Load more communities →</Link>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
