import { Panel } from "../ui";
import { AudioEvidencePlayer } from "../audio-evidence-player";

type TimelineEntry = {
  at?: string;
  type?: string;
  label?: string;
  silent?: boolean;
  details?: { media?: Parameters<typeof AudioEvidencePlayer>[0]["media"] & { mediaType?: string; contentType?: string } };
};

export function IncidentTimelinePanel({ incidentId, entries }: { incidentId: string; entries: TimelineEntry[] }) {
  return (
    <Panel title="Incident timeline">
      <ol className="space-y-3 text-sm">
        {entries.map((entry, index) => (
          <li key={`${entry.type ?? "event"}-${index}`} className="rounded-md border p-3">
            <div className="font-medium">{entry.label ?? entry.type ?? "Update"}</div>
            <div className="text-xs text-muted-foreground">
              {entry.at ? new Date(entry.at).toLocaleString() : "Unknown time"}
              {entry.type ? ` · ${entry.type}` : ""}
              {entry.silent ? " · Silent indicator" : ""}
            </div>
            {entry.details?.media && (entry.details.media.mediaType === "Audio" || entry.details.media.contentType?.startsWith("audio/")) ? (
              <AudioEvidencePlayer incidentId={incidentId} media={entry.details.media} />
            ) : null}
          </li>
        ))}
        {!entries.length ? <p className="text-muted-foreground">No timeline entries yet.</p> : null}
      </ol>
    </Panel>
  );
}
