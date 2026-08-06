import { AppShell } from "../../components/app-shell";
import { BroadcastWorkspace } from "../../components/broadcast/broadcast-workspace";
import { ConsolePageHeader } from "../../components/console";
import { StatusBadge } from "../../components/ui";
import { fetchAdminBroadcasts, fetchBroadcastSchedulerHealth, fetchNotificationDeliveryDiagnostics } from "../../lib/api/data";
import { getRouteById } from "../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

type BroadcastsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function BroadcastsPage({ searchParams }: BroadcastsPageProps) {
  const route = getRouteById("broadcasts");
  const params = await searchParams;
  const filters = {
    country: readParam(params.country),
    state: readParam(params.state),
    category: readParam(params.category),
    status: readParam(params.status),
    author: readParam(params.author),
  };
  const [broadcasts, diagnostics, scheduler] = await Promise.all([
    fetchAdminBroadcasts(filters),
    fetchNotificationDeliveryDiagnostics(),
    fetchBroadcastSchedulerHealth(),
  ]);
  const pending = broadcasts.filter((broadcast) => broadcast.status === "Pending approval" || broadcast.status === "PendingApproval").length;
  const published = broadcasts.filter((broadcast) => broadcast.status === "Published" || broadcast.status === "Active").length;
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
        filterDefaults={filters}
      />
    </AppShell>
  );
}
