import { PatrolManagementConsole } from "../../../components/community/patrol-management-console";
import { ConsolePageHeader } from "../../../components/console";
import { StatusBadge } from "../../../components/ui";
import { fetchCommunities, fetchPatrols } from "../../../lib/api/data";
import { getRouteById } from "../../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

export default async function PatrolManagementPage() {
  const route = getRouteById("patrol");
  const [patrols, communities] = await Promise.all([fetchPatrols(), fetchCommunities()]);

  return (
    <>
      <ConsolePageHeader
        title={route?.pageHeading ?? "Patrol management"}
        eyebrow="Schedule creation and lifecycle control"
        breadcrumbs={route?.breadcrumb}
        action={<StatusBadge tone="success">{patrols.length} schedules</StatusBadge>}
      />
      <PatrolManagementConsole patrols={patrols} communities={communities} />
    </>
  );
}
