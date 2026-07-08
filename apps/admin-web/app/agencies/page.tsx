import { AppShell } from "../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { agencies } from "../../lib/mock-data";

export default function AgenciesPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Responder network" title="Agency management" action={<StatusBadge tone="info">{agencies.length} agencies</StatusBadge>} />
      <Panel title="Agencies">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {agencies.map((agency) => (
            <div key={agency.name} className="rounded-lg border border-line bg-slate-50 p-4">
              <p className="font-semibold">{agency.name}</p>
              <p className="mt-1 text-sm text-muted">{agency.type} - {agency.jurisdiction}</p>
              <p className="mt-3 text-sm"><strong>{agency.activeIncidents}</strong> active incidents</p>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
