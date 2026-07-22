import { Panel } from "../ui";

type TimelineEntry = {
  at?: string;
  type?: string;
  label?: string;
  silent?: boolean;
};

export function IncidentTimelinePanel({ entries }: { entries: TimelineEntry[] }) {
  return (
    <Panel title="Incident timeline">
      <ol className="space-y-3 text-sm">
        {entries.map((entry, index) => (
          <li key={`${entry.type ?? "event"}-${index}`} className="rounded-md border p-3">
            <div className="font-medium">{entry.label ?? entry.type ?? "Update"}</div>
            <div className="text-xs text-muted-foreground">
              {entry.at ? new Date(entry.at).toISOString() : "Unknown time"}
              {entry.type ? ` · ${entry.type}` : ""}
              {entry.silent ? " · Silent indicator" : ""}
            </div>
          </li>
        ))}
        {!entries.length ? <p className="text-muted-foreground">No timeline entries yet.</p> : null}
      </ol>
    </Panel>
  );
}
