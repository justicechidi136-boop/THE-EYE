import { AppShell } from "../../../components/app-shell";
import { SafetyAlertsSubnav } from "../../../components/safety-alerts/safety-alerts-subnav";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchDangerZones } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function SafetyAlertsAllClearPage() {
  const zones = await fetchDangerZones();
  const queue = zones.filter((zone) => zone.status === "Contained" || zone.status === "Monitoring");

  return (
    <AppShell>
      <PageHeader eyebrow="Safety Alerts" title="All-clear queue" action={<StatusBadge tone="info">{queue.length} awaiting review</StatusBadge>} />
      <SafetyAlertsSubnav />
      <Panel title="Zones ready for all-clear review">
        <div className="grid gap-3">
          {queue.length ? queue.map((zone) => (
            <div key={zone.id} className="rounded-lg border border-line p-4">
              <p className="font-semibold">{zone.incidentTitle}</p>
              <p className="text-sm text-muted">{zone.status} · {zone.publicMessage}</p>
              <p className="mt-2 text-sm text-muted">Issue all-clear only after authorized confirmation that the threat is contained or resolved.</p>
            </div>
          )) : <p className="text-muted">No zones in the all-clear queue.</p>}
        </div>
      </Panel>
    </AppShell>
  );
}
