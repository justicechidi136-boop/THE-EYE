import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { fetchDispatchResponders } from "../../lib/api/dispatch";
import { fetchIncidents } from "../../lib/api/data";
import { deriveAgencySummaries } from "../../lib/dashboard-metrics";

export const dynamic = "force-dynamic";

export default async function AgenciesPage() {
  const [incidents, responders] = await Promise.all([fetchIncidents(), fetchDispatchResponders()]);
  const agencies = deriveAgencySummaries(incidents);
  const responderAgencies = new Map<string, number>();
  for (const responder of responders.data ?? []) {
    const label = responder.agencyId?.trim() || "Unassigned agency";
    responderAgencies.set(label, (responderAgencies.get(label) ?? 0) + 1);
  }

  return (
    <AppShell>
      <PageHeader eyebrow="Responder network" title="Agency management" action={<StatusBadge tone="info">{agencies.length} active agencies</StatusBadge>} />
      <Panel title="Agencies from incident assignments">
        <p className="mb-4 text-sm text-muted">
          Live workload counts from <code className="text-xs">GET /v1/incidents</code> and responder availability from{" "}
          <code className="text-xs">GET /v1/dispatch/responders</code>.
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {agencies.length ? agencies.map((agency) => (
            <div key={agency.name} className="rounded-lg border border-line bg-surfaceMuted p-4">
              <p className="font-semibold">{agency.name}</p>
              <p className="mt-1 text-sm text-muted">{agency.type} · {agency.jurisdiction}</p>
              <p className="mt-3 text-sm"><strong>{agency.activeIncidents}</strong> active incidents</p>
              <Link href="/dispatch" className="mt-3 inline-block text-sm font-semibold text-eye hover:underline">Open command center →</Link>
            </div>
          )) : <p className="text-sm text-muted">No assigned agencies found in the current incident scope.</p>}
        </div>
      </Panel>
      <Panel title="Responder availability by agency">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[...responderAgencies.entries()].map(([agencyId, count]) => (
            <div key={agencyId} className="rounded-lg border border-line bg-surfaceMuted p-4 text-sm">
              <p className="font-semibold">{agencyId}</p>
              <p className="mt-1 text-muted">{count} responders tracked</p>
            </div>
          ))}
          {!responderAgencies.size ? <p className="text-sm text-muted">No responders returned for this scope.</p> : null}
        </div>
      </Panel>
    </AppShell>
  );
}
