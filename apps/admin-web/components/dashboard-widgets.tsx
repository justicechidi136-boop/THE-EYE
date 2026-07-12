import { Panel } from "./ui";
import type { DashboardChartPoint, Incident } from "../lib/types/admin-views";

function formatTimestamp(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DashboardChart({
  chartData,
  footnote,
}: {
  chartData: DashboardChartPoint[];
  footnote: string;
}) {
  const lastMonth = chartData[chartData.length - 1]?.month ?? "current month";

  return (
    <Panel
      title="Operations overview"
      aside={
        <div className="flex flex-wrap gap-3 text-xs font-semibold">
          <span className="inline-flex items-center gap-1 text-eye"><span className="h-2 w-2 rounded-full bg-eye" /> No. of Report</span>
          <span className="inline-flex items-center gap-1 text-eyeOrange"><span className="h-2 w-2 rounded-full bg-eyeOrange" /> No. of Users</span>
          <span className="inline-flex items-center gap-1 text-ink"><span className="h-2 w-2 rounded-full bg-ink" /> No. of Live Videos</span>
        </div>
      }
    >
      {chartData.length ? (
        <div className="overflow-x-auto">
          <div className="flex min-w-[720px] items-end gap-3">
            {chartData.map((entry) => (
              <div key={entry.month} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-40 w-full items-end justify-center gap-1">
                  <div className="w-3 rounded-t bg-eye" style={{ height: `${Math.max(entry.reports, 2)}%` }} title={`Reports ${entry.reports}`} />
                  <div className="w-3 rounded-t bg-eyeOrange" style={{ height: `${Math.max(entry.users, 2)}%` }} title={`Users ${entry.users}`} />
                  <div className="w-3 rounded-t bg-ink" style={{ height: `${Math.max(entry.videos, 2)}%` }} title={`Videos ${entry.videos}`} />
                </div>
                <span className="text-xs text-muted">{entry.month}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">No chart data available from live APIs yet.</p>
      )}
      <p className="mt-3 text-xs text-muted">Monthly trend through {lastMonth}. {footnote}</p>
    </Panel>
  );
}

export function DashboardActivityFeeds({ incidents }: { incidents: Incident[] }) {
  const liveItems = incidents.slice(0, 4).map((incident) => ({
    id: incident.id,
    label: `${incident.reportingMode === "Anonymous" ? "Anonymous reporter" : "Citizen reporter"} just reported a live video`,
    time: formatTimestamp(incident.createdAt ?? incident.timeline[0]?.time ?? ""),
    href: "/live-video",
  }));
  const reportItems = incidents.slice(0, 4).map((incident) => ({
    id: incident.id,
    label: `${incident.reportingMode === "Anonymous" ? "Anonymous reporter" : "Citizen reporter"} just reported ${incident.type.toLowerCase()}`,
    time: formatTimestamp(incident.createdAt ?? incident.timeline[0]?.time ?? ""),
    href: `/incidents/${incident.id}`,
  }));

  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <ActivityFeed title="Live Video" items={liveItems} />
      <ActivityFeed title="Reports" items={reportItems} />
    </section>
  );
}

function ActivityFeed({
  title,
  items,
}: {
  title: string;
  items: { id: string; label: string; time: string; href: string }[];
}) {
  return (
    <Panel
      title={title}
      aside={
        <a href={title === "Live Video" ? "/live-video" : "/incidents"} className="text-sm font-semibold text-eye hover:underline">
          View All
        </a>
      }
    >
      <div className="grid gap-3">
        {items.length ? items.map((item) => (
          <a key={item.id} href={item.href} className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surfaceMuted p-3 transition-colors hover:border-eye/30">
            <div>
              <p className="text-sm font-medium text-ink">{item.label}</p>
              <p className="mt-1 text-xs text-muted">{item.time}</p>
            </div>
            <span className="rounded-full bg-surface px-2 py-1 text-xs font-semibold text-eye">Open</span>
          </a>
        )) : <p className="text-sm text-muted">No recent activity.</p>}
      </div>
    </Panel>
  );
}
