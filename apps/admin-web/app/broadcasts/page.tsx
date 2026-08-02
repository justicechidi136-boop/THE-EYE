import { AppShell } from "../../components/app-shell";
import { BroadcastWorkspace } from "../../components/broadcast/broadcast-workspace";
import { ConsolePageHeader } from "../../components/console";
import { StatusBadge } from "../../components/ui";
import { fetchBroadcasts, fetchBroadcastSchedulerHealth, fetchNotificationDeliveryDiagnostics } from "../../lib/api/data";
import { getRouteById } from "../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

export default async function BroadcastsPage() {
  const route = getRouteById("broadcasts");
  const [broadcasts, diagnostics, scheduler] = await Promise.all([
    fetchBroadcasts(),
    fetchNotificationDeliveryDiagnostics(),
    fetchBroadcastSchedulerHealth(),
  ]);
  const pending = broadcasts.filter((broadcast) => broadcast.status === "Pending approval").length;
  const published = broadcasts.filter((broadcast) => broadcast.status === "Published").length;
  const scheduled = broadcasts.filter((broadcast) => broadcast.status === "Scheduled").length;
  const queueWaiting = Number(diagnostics?.queue?.waiting ?? 0);
  const workerActive = diagnostics?.worker?.active === true;
  const schedulerActive = scheduler?.active === true;

  return (
    <AppShell>
      <ConsolePageHeader
        title={route?.pageHeading ?? "Emergency broadcasts"}
        eyebrow="Location-based public messaging"
        breadcrumbs={route?.breadcrumb}
        action={<StatusBadge tone="warning">{pending} approvals pending</StatusBadge>}
      />
      <BroadcastWorkspace
        broadcasts={broadcasts}
        pending={pending}
        published={published}
        scheduled={scheduled}
        queueWaiting={queueWaiting}
        workerActive={workerActive}
        schedulerActive={schedulerActive}
        dueCount={scheduler?.dueCount}
      />
    </AppShell>
  );
}
