import { AppShell } from "../../../components/app-shell";
import { SafetyAlertsSubnav } from "../../../components/safety-alerts/safety-alerts-subnav";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchDangerZones } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function PendingDangerZonesPage() {
  const zones = await fetchDangerZones();
  const pending = zones.filter((zone) => zone.status === "PendingVerification");

  return (
    <AppShell>
      <PageHeader eyebrow="Safety Alerts" title="Pending verification" action={<StatusBadge tone="warning">{pending.length} pending</StatusBadge>} />
      <SafetyAlertsSubnav />
      <Panel title="Awaiting approval">
        <div className="grid gap-3">
          {pending.length ? pending.map((zone) => (
            <div key={zone.id} className="rounded-lg border border-line p-4">
              <p className="font-semibold">{zone.incidentTitle}</p>
              <p className="text-sm text-muted">{zone.publicMessage}</p>
              <p className="mt-2 text-sm">Confidence {zone.confidence}% · {zone.avoidanceInstruction}</p>
            </div>
          )) : <p className="text-muted">No zones awaiting verification.</p>}
        </div>
      </Panel>
    </AppShell>
  );
}
