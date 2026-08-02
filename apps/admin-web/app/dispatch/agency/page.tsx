import { AppShell } from "../../../components/app-shell";
import { AgencyDispatchConsole } from "../../../components/dispatch/agency-dispatch-console";
import { ConsolePageHeader } from "../../../components/console";
import { StatusBadge } from "../../../components/ui";
import { fetchDispatchIncidents, fetchDispatchResponders } from "../../../lib/api/dispatch";
import { getRouteById } from "../../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

export default async function AgencyDispatchPage() {
  const route = getRouteById("agency-dispatch");
  const [unassigned, assigned, responding, responders] = await Promise.all([
    fetchDispatchIncidents({ unassignedOnly: "true" }),
    fetchDispatchIncidents({ status: "Assigned" }),
    fetchDispatchIncidents({ status: "Responding" }),
    fetchDispatchResponders(),
  ]);

  const unassignedRows = unassigned.data ?? [];
  const assignedRows = assigned.data ?? [];
  const respondingRows = responding.data ?? [];

  return (
    <AppShell>
      <ConsolePageHeader
        title={route?.pageHeading ?? "Agency dispatch console"}
        eyebrow="Agency operations"
        breadcrumbs={route?.breadcrumb}
        action={<StatusBadge tone="warning">{unassignedRows.length} unassigned</StatusBadge>}
      />
      <AgencyDispatchConsole
        unassigned={unassignedRows}
        assigned={assignedRows}
        responding={respondingRows}
        responders={responders.data ?? []}
      />
    </AppShell>
  );
}
