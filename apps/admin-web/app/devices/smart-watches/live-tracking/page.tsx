import { AppShell } from "../../../../components/app-shell";
import { SmartwatchLiveTracking } from "../../../../components/smartwatch/smartwatch-live-tracking";
import { SmartwatchSubnav } from "../../../../components/smartwatch/smartwatch-subnav";
import { PageHeader, Panel, StatusBadge } from "../../../../components/ui";
import { fetchSosEvents } from "../../../../lib/api/data";
import { getAdminSession } from "../../../../lib/session";
import { canManageSmartwatches, canViewSmartwatchSos } from "../../../../lib/smartwatch-permissions";

export const dynamic = "force-dynamic";

export default async function SmartWatchLiveTrackingPage() {
  const session = await getAdminSession();
  const canManage = canManageSmartwatches(session);
  const canViewSos = canViewSmartwatchSos(session);
  const sosEvents = canViewSos ? await fetchSosEvents() : [];
  const active = sosEvents.filter((event) => event.status === "Active");

  return (
    <AppShell>
      <PageHeader eyebrow="Devices" title="Live tracking" action={<StatusBadge tone="danger">{active.length} active</StatusBadge>} />
      <SmartwatchSubnav canManage={canManage} />
      {!canViewSos ? (
        <Panel title="Live tracking access">
          <div role="alert" className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            Your admin account does not have permission to view smartwatch emergency locations.
          </div>
        </Panel>
      ) : (
        <SmartwatchLiveTracking events={sosEvents} />
      )}
    </AppShell>
  );
}
