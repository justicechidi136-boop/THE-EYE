import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { DroneSurveillanceSubnav } from "../../../components/drone/drone-surveillance-subnav";
import { EmptyState, TableScrollHint } from "../../../components/form-primitives";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchDroneEvidence } from "../../../lib/api/data";
import { canCommandDroneMission, canManageDroneFleet, canViewDroneEvidence, canViewDroneSurveillance } from "../../../lib/drone-permissions";
import { getAdminSession } from "../../../lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DroneEvidencePage() {
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session) || !canViewDroneEvidence(session)) redirect("/");
  const evidence = await fetchDroneEvidence().catch(() => []);

  return (
    <AppShell>
      <PageHeader eyebrow="Drone Surveillance" title="Evidence gallery" action={<StatusBadge tone="info">{evidence.length} items</StatusBadge>} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <Panel title="Aerial evidence">
        {!evidence.length ? (
          <EmptyState title="No aerial evidence captured" description="Video, imagery, and sensor captures linked to missions will appear here and can be attached to incidents." />
        ) : (
          <div>
            <TableScrollHint />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                  <tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Mission</th><th className="px-4 py-3">Incident</th><th className="px-4 py-3">Captured</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {evidence.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-semibold">{item.title}</td>
                      <td className="px-4 py-3">{item.mediaType}</td>
                      <td className="px-4 py-3">{item.mission?.missionCode ?? item.missionId}</td>
                      <td className="px-4 py-3">{item.incident ? <Link href={`/incidents/${item.incident.id}`} className="text-eye hover:underline">{item.incident.title}</Link> : "—"}</td>
                      <td className="px-4 py-3 text-muted">{item.capturedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
