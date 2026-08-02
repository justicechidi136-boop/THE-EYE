"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ConsoleDataTable,
  ConsoleEmptyState,
  ConsoleMetrics,
} from "../console";
import { Button, InlineAlert } from "../form-primitives";
import { Panel } from "../ui";
import type { CommunityChannelView, ContentReportView } from "../../lib/types/admin-views";

type CommunityChatConsoleProps = {
  channels: CommunityChannelView[];
  reports: ContentReportView[];
};

export function CommunityChatConsole({ channels, reports }: CommunityChatConsoleProps) {
  const router = useRouter();
  const [communityFilter, setCommunityFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const communityOptions = useMemo(
    () => [...new Set(channels.map((channel) => channel.communityName))].sort(),
    [channels],
  );

  const filteredChannels = useMemo(
    () => (communityFilter ? channels.filter((channel) => channel.communityName === communityFilter) : channels),
    [channels, communityFilter],
  );

  const pendingReports = useMemo(
    () => reports.filter((report) => report.status === "Pending" || report.status === "Submitted"),
    [reports],
  );

  async function reviewReport(reportId: string, action: "reviewed" | "dismissed") {
    setBusyId(reportId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/csoc/reports/${reportId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: `Marked ${action} from community chat console` }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Report review failed");
      setMessage(`Report marked ${action}.`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Report review failed");
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
          { label: "Channels", value: String(channels.length) },
          { label: "Communities", value: String(communityOptions.length) },
          { label: "Pending reports", value: String(pendingReports.length) },
          { label: "Total reports", value: String(reports.length) },
        ]}
      />
      <Panel title="Moderation reports">
        {pendingReports.length ? (
          <ConsoleDataTable
            columns={["Community", "Target", "Reason", "Submitted", "Actions"]}
            rows={pendingReports.map((report) => [
              report.communityName,
              `${report.targetType} · ${report.targetId.slice(0, 8)}`,
              report.reasonCode,
              report.createdAt ? new Date(report.createdAt).toLocaleString() : "—",
              <div key={`actions-${report.id}`} className="flex gap-2">
                <Button type="button" variant="primary" disabled={busyId === report.id} onClick={() => reviewReport(report.id, "reviewed")}>Reviewed</Button>
                <Button type="button" variant="secondary" disabled={busyId === report.id} onClick={() => reviewReport(report.id, "dismissed")}>Dismiss</Button>
              </div>,
            ])}
          />
        ) : (
          <ConsoleEmptyState title="No pending moderation reports" detail="Reports from community channels will appear here." />
        )}
      </Panel>
      <Panel title="Community channels">
        <label className="mb-4 grid max-w-sm gap-1 text-sm">
          <span className="font-medium text-muted">Community</span>
          <select
            className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
            value={communityFilter}
            onChange={(event) => setCommunityFilter(event.target.value)}
          >
            <option value="">All communities</option>
            {communityOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredChannels.length ? filteredChannels.map((channel) => (
            <Link
              key={channel.id}
              href={`/neighborhood-watch/chat/${channel.id}`}
              className="rounded-lg border border-line bg-surfaceMuted px-4 py-3 transition-colors hover:border-eye"
            >
              <p className="text-sm font-semibold">{channel.name}</p>
              <p className="mt-1 text-xs text-muted">{channel.communityName} · {channel.type}</p>
              <p className="mt-2 text-xs font-semibold text-eye">Open channel →</p>
            </Link>
          )) : (
            <ConsoleEmptyState title="No channels in filter" detail="Select another community or widen scope." />
          )}
        </div>
      </Panel>
    </div>
  );
}
