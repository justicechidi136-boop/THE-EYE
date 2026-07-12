import { AppShell } from "../../components/app-shell";
import { PlaceholderNotice } from "../../components/placeholder-notice";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { fetchIncidents } from "../../lib/api/data";
import { deriveAgencySummaries } from "../../lib/dashboard-metrics";
import { PLACEHOLDER_DEPENDENCIES } from "../../lib/placeholder-dependencies";

export const dynamic = "force-dynamic";

export default async function AgenciesPage() {
  const incidents = await fetchIncidents();
  const agencies = deriveAgencySummaries(incidents);
  const dependency = PLACEHOLDER_DEPENDENCIES.agencies;

  return (
    <AppShell>
      <PageHeader eyebrow="Responder network" title="Agency management" action={<StatusBadge tone="info">{agencies.length} agencies</StatusBadge>} />
      <Panel title="Agencies">
        <div className="mb-4">
          <PlaceholderNotice title={dependency.title} endpoint={dependency.endpoint} note={dependency.note} />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {agencies.length ? agencies.map((agency) => (
            <div key={agency.name} className="rounded-lg border border-line bg-surfaceMuted p-4">
              <p className="font-semibold">{agency.name}</p>
              <p className="mt-1 text-sm text-muted">{agency.type} - {agency.jurisdiction}</p>
              <p className="mt-3 text-sm"><strong>{agency.activeIncidents}</strong> active incidents</p>
            </div>
          )) : <p className="text-sm text-muted">No assigned agencies found in the current incident scope.</p>}
        </div>
      </Panel>
    </AppShell>
  );
}
