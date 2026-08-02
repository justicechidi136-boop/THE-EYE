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
import type { ResidentView } from "../../lib/types/admin-views";

const ROLE_OPTIONS = [
  "Resident",
  "CommunityModerator",
  "EstateAdmin",
  "SecurityCoordinator",
  "PoliceLiaison",
  "VolunteerCoordinator",
  "VerifiedVolunteer",
] as const;

type MembershipApprovalConsoleProps = {
  memberships: ResidentView[];
  hasMore: boolean;
  nextCursor?: string;
  filters: Record<string, string | undefined>;
};

function statusTone(status: string): "success" | "warning" | "neutral" | "info" {
  if (status === "Approved") return "success";
  if (status === "Pending") return "warning";
  if (status === "Rejected" || status === "Banned") return "neutral";
  if (status === "Suspended") return "info";
  return "info";
}

export function MembershipApprovalConsole({
  memberships,
  hasMore,
  nextCursor,
  filters,
}: MembershipApprovalConsoleProps) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roleSelections, setRoleSelections] = useState<Record<string, string>>({});

  const metrics = useMemo(() => ({
    pending: memberships.filter((m) => m.status === "Pending").length,
    approved: memberships.filter((m) => m.status === "Approved").length,
    suspended: memberships.filter((m) => m.status === "Suspended").length,
    rejected: memberships.filter((m) => m.status === "Rejected").length,
  }), [memberships]);

  async function runMembershipAction(
    membership: ResidentView,
    action: "approve" | "reject" | "suspend" | "restore" | "ban" | "unban",
  ) {
    setBusyKey(`${membership.membershipId}-${action}`);
    setError(null);
    setMessage(null);
    try {
      const endpoint =
        action === "approve" || action === "reject"
          ? `/api/csoc/memberships/${membership.membershipId}/approve`
          : `/api/csoc/memberships/${membership.membershipId}/moderate`;
      const body =
        action === "approve" || action === "reject"
          ? { communityId: membership.communityId, action }
          : { communityId: membership.communityId, action, note: `Updated from membership console (${action})` };
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Membership action failed");
      setMessage(`Membership ${action} completed.`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Membership action failed");
    } finally {
      setBusyKey(null);
    }
  }

  async function assignRole(membership: ResidentView) {
    const roleName = roleSelections[membership.membershipId] ?? membership.role;
    setBusyKey(`${membership.membershipId}-role`);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/neighborhood-watch/memberships/${membership.membershipId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communityId: membership.communityId, roleName }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Role assignment failed");
      setMessage(`Role updated to ${roleName}.`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Role assignment failed");
    } finally {
      setBusyKey(null);
    }
  }

  const nextHref = hasMore && nextCursor
    ? `/neighborhood-watch/approvals?${new URLSearchParams({ ...filters, cursor: nextCursor }).toString()}`
    : undefined;

  return (
    <div className="grid gap-5">
      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      <ConsoleMetrics
        items={[
          { label: "Pending", value: String(metrics.pending) },
          { label: "Approved", value: String(metrics.approved) },
          { label: "Suspended", value: String(metrics.suspended) },
          { label: "Rejected", value: String(metrics.rejected) },
        ]}
      />
      <Panel title="Membership queue">
        <ConsoleFilterBar>
          <ConsoleSearchInput label="Search applicant" placeholder="Name or email" defaultValue={filters.q} name="q" />
          <ConsoleFilterSelect
            name="status"
            label="Status"
            defaultValue={filters.status ?? ""}
            options={[
              { value: "", label: "All statuses" },
              { value: "Pending", label: "Pending" },
              { value: "Approved", label: "Approved" },
              { value: "Suspended", label: "Suspended" },
              { value: "Rejected", label: "Rejected" },
              { value: "Banned", label: "Banned" },
            ]}
          />
        </ConsoleFilterBar>
        {memberships.length ? (
          <ConsoleDataTable
            columns={["Applicant", "Community", "Status", "Role", "Trust", "Actions"]}
            rows={memberships.map((membership) => [
              <div key={`name-${membership.membershipId}`}>
                <p className="font-semibold">{membership.name}</p>
                <p className="text-xs text-muted">{membership.email}</p>
              </div>,
              membership.community,
              <StatusBadge key={`status-${membership.membershipId}`} tone={statusTone(membership.status)}>{membership.status}</StatusBadge>,
              <select
                key={`role-${membership.membershipId}`}
                className="rounded-md border border-line bg-surface px-2 py-1 text-xs"
                value={roleSelections[membership.membershipId] ?? membership.role}
                onChange={(event) => setRoleSelections((current) => ({ ...current, [membership.membershipId]: event.target.value }))}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>,
              `${membership.trustScore}%`,
              <div key={`actions-${membership.membershipId}`} className="flex flex-wrap gap-2">
                {membership.status === "Pending" ? (
                  <>
                    <Button type="button" variant="primary" disabled={busyKey === `${membership.membershipId}-approve`} onClick={() => runMembershipAction(membership, "approve")}>Approve</Button>
                    <Button type="button" variant="danger" disabled={busyKey === `${membership.membershipId}-reject`} onClick={() => runMembershipAction(membership, "reject")}>Reject</Button>
                  </>
                ) : null}
                {membership.status === "Approved" ? (
                  <Button type="button" variant="secondary" disabled={busyKey === `${membership.membershipId}-suspend`} onClick={() => runMembershipAction(membership, "suspend")}>Suspend</Button>
                ) : null}
                {membership.status === "Suspended" ? (
                  <Button type="button" variant="secondary" disabled={busyKey === `${membership.membershipId}-restore`} onClick={() => runMembershipAction(membership, "restore")}>Restore</Button>
                ) : null}
                {membership.status !== "Banned" ? (
                  <Button type="button" variant="danger" disabled={busyKey === `${membership.membershipId}-ban`} onClick={() => runMembershipAction(membership, "ban")}>Ban</Button>
                ) : (
                  <Button type="button" variant="secondary" disabled={busyKey === `${membership.membershipId}-unban`} onClick={() => runMembershipAction(membership, "unban")}>Unban</Button>
                )}
                <Button type="button" variant="secondary" disabled={busyKey === `${membership.membershipId}-role`} onClick={() => assignRole(membership)}>Assign role</Button>
              </div>,
            ])}
          />
        ) : (
          <ConsoleEmptyState title="No memberships in scope" detail="Adjust filters to review other membership states." />
        )}
        {nextHref ? (
          <div className="mt-4">
            <a href={nextHref} className="text-sm font-semibold text-eye hover:underline">Load more memberships →</a>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
