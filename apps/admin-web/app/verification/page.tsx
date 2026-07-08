import { AppShell } from "../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { incidents } from "../../lib/mock-data";

const signals = ["GPS accuracy", "Reporter trust", "Media evidence", "Nearby duplicates", "Crowd confirmations", "False-report history"];

export default function VerificationPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Confidence scoring" title="Verification queue" action={<StatusBadge tone="warning">1-5s target</StatusBadge>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Panel title="Queue">
          <div className="grid gap-3">
            {incidents.map((incident) => (
              <div key={incident.id} className="rounded-lg border border-line p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{incident.title}</p>
                    <p className="mt-1 text-sm text-muted">{incident.location}</p>
                  </div>
                  <StatusBadge tone={incident.confidenceScore >= 85 ? "success" : incident.confidenceScore >= 70 ? "info" : "warning"}>
                    {incident.confidenceScore}% confidence
                  </StatusBadge>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <span className="rounded-md bg-slate-50 px-3 py-2 text-sm text-muted">GPS {incident.gps.accuracy}</span>
                  <span className="rounded-md bg-slate-50 px-3 py-2 text-sm text-muted">{incident.evidence.length} evidence files</span>
                  <span className="rounded-md bg-slate-50 px-3 py-2 text-sm text-muted">{incident.reporterStatus}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Scoring signals">
          <div className="grid gap-2">
            {signals.map((signal) => <div key={signal} className="rounded-md border border-line bg-slate-50 px-3 py-2 text-sm">{signal}</div>)}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
