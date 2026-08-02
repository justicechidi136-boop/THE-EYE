import { AppShell } from "../../components/app-shell";
import { CommandCentreConsole } from "../../components/dispatch/command-centre-console";
import { ConsolePageHeader } from "../../components/console";
import { StatusBadge } from "../../components/ui";
import { fetchDispatchIncidents, fetchDispatchResponders } from "../../lib/api/dispatch";
import { getRouteById } from "../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

export default async function DispatchCommandCenterPage() {
  const route = getRouteById("emergency-command");
  const [queue, responders] = await Promise.all([
    fetchDispatchIncidents({ unassignedOnly: "true" }),
    fetchDispatchResponders(),
  ]);

  const incidents = queue.data ?? [];

  return (
    <AppShell>
      <ConsolePageHeader
        title={route?.pageHeading ?? "Emergency command center"}
        eyebrow="Dispatch operations"
        breadcrumbs={route?.breadcrumb}
        action={<StatusBadge tone="danger">{incidents.length} unassigned</StatusBadge>}
      />
      <CommandCentreConsole queue={incidents} responders={responders.data ?? []} />
    </AppShell>
  );
}
