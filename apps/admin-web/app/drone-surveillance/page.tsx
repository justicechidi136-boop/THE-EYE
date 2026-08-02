import { AppShell } from "../../components/app-shell";
import { DroneSurveillanceSubnav } from "../../components/drone/drone-surveillance-subnav";
import { DroneMissionTable } from "../../components/drone/drone-mission-table";
import { MetricCard, PageHeader, Panel, StatusBadge } from "../../components/ui";
import { fetchDroneDashboard, fetchDroneMissions } from "../../lib/api/data";
import {
  canCommandDroneMission,
  canManageDroneFleet,
  canViewDroneSurveillance,
} from "../../lib/drone-permissions";
import { getAdminSession } from "../../lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DroneSurveillanceDashboardPage() {
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");

  const [dashboard, activeMissions] = await Promise.all([
    fetchDroneDashboard().catch(() => ({
      fleetActive: 0,
      activeMissions: 0,
      scheduledMissions: 0,
      liveVideoStreams: 0,
      evidenceItems: 0,
      activeOperators: 0,
      geofences: 0,
      noFlyZones: 0,
    })),
    fetchDroneMissions().catch(() => []),
  ]);

  const liveMissions = activeMissions.filter((m) => ["Active", "Preflight", "Paused"].includes(m.status));

  return (
    <AppShell>
      <PageHeader
        eyebrow="Aerial operations"
        title="Drone Surveillance"
        action={<StatusBadge tone="info">{dashboard.activeMissions} active missions</StatusBadge>}
      />
      <DroneSurveillanceSubnav
        canManage={canManageDroneFleet(session)}
        canCommand={canCommandDroneMission(session)}
      />
      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Fleet online" value={`${dashboard.fleetActive}`} detail="Registered active drones" accent="eye" />
        <MetricCard label="Live video streams" value={`${dashboard.liveVideoStreams}`} detail="Missions broadcasting video" accent="eyeOrange" />
        <MetricCard label="Scheduled missions" value={`${dashboard.scheduledMissions}`} detail="Awaiting launch window" />
        <MetricCard label="Evidence items" value={`${dashboard.evidenceItems}`} detail="Linked aerial captures" />
      </section>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Active missions">
          <DroneMissionTable missions={liveMissions.slice(0, 8)} />
        </Panel>
        <Panel title="Airspace controls">
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between border-b border-line pb-2"><dt className="text-muted">Active operators</dt><dd className="font-semibold">{dashboard.activeOperators}</dd></div>
            <div className="flex justify-between border-b border-line pb-2"><dt className="text-muted">Operational geofences</dt><dd className="font-semibold">{dashboard.geofences}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">No-fly zones</dt><dd className="font-semibold">{dashboard.noFlyZones}</dd></div>
          </dl>
        </Panel>
      </div>
    </AppShell>
  );
}
