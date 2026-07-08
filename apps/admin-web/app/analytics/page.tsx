import { AppShell } from "../../components/app-shell";
import { MetricCard, PageHeader, Panel, StatusBadge } from "../../components/ui";
import { agencies, incidents } from "../../lib/mock-data";

export default function AnalyticsPage() {
  const averageConfidence = Math.round(incidents.reduce((sum, incident) => sum + incident.confidenceScore, 0) / incidents.length);
  return (
    <AppShell>
      <PageHeader eyebrow="Operational intelligence" title="Analytics dashboard" action={<StatusBadge tone="success">Jurisdiction scoped</StatusBadge>} />
      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Average confidence" value={`${averageConfidence}%`} />
        <MetricCard label="Assigned agencies" value={String(agencies.length)} />
        <MetricCard label="P1/P2 load" value={String(incidents.filter((incident) => incident.priority === "P1" || incident.priority === "P2").length)} />
        <MetricCard label="Evidence files" value={String(incidents.reduce((sum, incident) => sum + incident.evidence.length, 0))} />
      </section>
      <Panel title="Incident mix">
        <div className="grid gap-3 md:grid-cols-3">
          {incidents.map((incident) => (
            <div key={incident.id} className="rounded-lg border border-line bg-slate-50 p-4">
              <p className="font-semibold">{incident.type}</p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                <div className="h-full bg-eye" style={{ width: `${incident.confidenceScore}%` }} />
              </div>
              <p className="mt-2 text-sm text-muted">{incident.confidenceScore}% confidence</p>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
