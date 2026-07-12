import type { AuditLogView } from "../../lib/types/admin-views";
import { Panel, StatusBadge } from "../ui";

export function CsocActivityTimeline({ entries }: { entries: AuditLogView[] }) {
  return (
    <Panel title="Recent activity">
      <ol className="grid gap-3">
        {entries.length ? entries.map((entry) => (
          <li key={entry.sequence} className="rounded-lg border border-line bg-surfaceMuted px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{entry.action}</p>
              <StatusBadge tone="neutral">{entry.time}</StatusBadge>
            </div>
            <p className="mt-1 text-sm text-muted">{entry.actor} · {entry.entity}</p>
            {entry.reason ? <p className="mt-1 text-xs text-muted">{entry.reason}</p> : null}
          </li>
        )) : (
          <li className="text-sm text-muted">No recent community activity logged.</li>
        )}
      </ol>
    </Panel>
  );
}
