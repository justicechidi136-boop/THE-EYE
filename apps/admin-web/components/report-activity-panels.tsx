import {
  buildReportActivity,
  formatReportCapturedAt,
  summarizeEvidenceAccess,
  type ReportTimelineEntry,
} from "../lib/report-details-presentation";
import type { EvidenceAccessEntry, Incident } from "../lib/types/admin-views";
import { Panel } from "./ui";

function ActivityList({ items }: { items: Array<{ at?: string; label: string }> }) {
  if (!items.length) return <p className="text-sm text-muted">No activity recorded yet.</p>;
  return (
    <ol className="grid gap-3">
      {items.map((item, index) => (
        <li key={`${item.label}-${item.at ?? index}`} className="grid grid-cols-[10px_minmax(0,1fr)] gap-3">
          <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-eye" aria-hidden="true" />
          <div className="min-w-0"><p className="break-words text-sm font-medium text-ink">{item.label}</p><p className="mt-1 text-xs text-muted">{formatReportCapturedAt(item.at)}</p></div>
        </li>
      ))}
    </ol>
  );
}

export function ReportActivityPanels({ report, entries, evidenceAccessLogs }: { report: Incident; entries: ReportTimelineEntry[]; evidenceAccessLogs: EvidenceAccessEntry[] }) {
  const activity = buildReportActivity(entries, report.type);
  const progress = activity.filter((item) => item.category === "progress");
  const evidence = activity.filter((item) => item.category === "evidence");
  const admin = activity.filter((item) => item.category === "admin");
  const accessHistory = summarizeEvidenceAccess(evidenceAccessLogs, report);
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Panel title="Report timeline"><ActivityList items={progress} /></Panel>
      <Panel title="Evidence activity">
        <div className="grid gap-4">
          <ActivityList items={evidence} />
          {accessHistory.length ? <div className="border-t border-line pt-4"><p className="mb-3 text-xs font-semibold uppercase text-muted">Recent access history</p><ol className="grid gap-3">{accessHistory.map((entry) => <li key={`${entry.sentence}-${entry.time}`}><p className="text-sm font-medium text-ink">{entry.sentence}</p><p className="mt-1 text-xs text-muted">{entry.time}</p></li>)}</ol></div> : null}
        </div>
      </Panel>
      <Panel title="Admin activity"><ActivityList items={admin} /></Panel>
    </div>
  );
}
