import Link from "next/link";
import { ConsolePageHeader } from "../../../../components/console";
import { Panel, StatusBadge } from "../../../../components/ui";
import { fetchPatrolDetail } from "../../../../lib/api/data";
import { getRouteById } from "../../../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

export default async function PatrolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const route = getRouteById("patrol");
  const patrol = await fetchPatrolDetail(id);

  if (!patrol) {
    return (
      <ConsolePageHeader title="Patrol not found" eyebrow="Patrol management" breadcrumbs={route?.breadcrumb} />
    );
  }

  return (
    <>
      <ConsolePageHeader
        title={patrol.title}
        eyebrow={patrol.community}
        breadcrumbs={[...(route?.breadcrumb ?? []), patrol.title]}
        action={<StatusBadge tone={patrol.status === "Active" ? "success" : "info"}>{patrol.status}</StatusBadge>}
      />
      <Panel title="Patrol schedule">
        <div className="grid gap-3 text-sm">
          <p><strong>Community:</strong> {patrol.community}</p>
          <p><strong>Starts:</strong> {patrol.startsAt ? new Date(patrol.startsAt).toLocaleString() : "—"}</p>
          <p><strong>Ends:</strong> {patrol.endsAt ? new Date(patrol.endsAt).toLocaleString() : "—"}</p>
          <p><strong>Volunteers assigned:</strong> {patrol.volunteers}</p>
          <p><strong>Checkpoints logged:</strong> {patrol.checkpoints}</p>
          <Link href="/neighborhood-watch/patrols" className="text-eye hover:underline">← Back to patrol management</Link>
        </div>
      </Panel>
    </>
  );
}
