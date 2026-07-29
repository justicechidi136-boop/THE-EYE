import { AppShell } from "../../../components/app-shell";
import { SafetyAlertsSubnav } from "../../../components/safety-alerts/safety-alerts-subnav";
import { PageHeader, Panel } from "../../../components/ui";
import { fetchDangerZones } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function SafetyAlertsMapPage() {
  const zones = await fetchDangerZones();

  return (
    <AppShell>
      <PageHeader eyebrow="Safety Alerts" title="Geo-zone map" />
      <SafetyAlertsSubnav />
      <Panel title="Zone layers">
        <div className="grid min-h-[420px] gap-3">
          {zones.map((zone) => (
            <div key={zone.id} className="rounded-lg border border-line bg-surfaceMuted p-4">
              <p className="font-semibold">{zone.incidentTitle}</p>
              <p className="text-sm text-muted">{zone.status} · inner {zone.innerRadiusMeters}m · warning {zone.warningRadiusMeters}m · awareness {zone.outerAwarenessRadiusMeters}m</p>
              <a className="mt-2 inline-block text-sm font-semibold text-eye" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(zone.publicMessage)}`}>
                Open map context
              </a>
            </div>
          ))}
          {!zones.length ? <p className="text-muted">No active map layers yet.</p> : null}
        </div>
      </Panel>
    </AppShell>
  );
}
