import Link from "next/link";
import { AppShell } from "../../../../../../../components/app-shell";
import { SmartwatchSubnav } from "../../../../../../../components/smartwatch/smartwatch-subnav";
import { PageHeader, Panel, StatusBadge } from "../../../../../../../components/ui";
import { fetchWatchInventory, fetchWatchOwnerDetail } from "../../../../../../../lib/api/data";
import { getAdminSession } from "../../../../../../../lib/session";
import { canManageSmartwatches } from "../../../../../../../lib/smartwatch-permissions";
import type { WatchInventoryRowView } from "../../../../../../../lib/types/admin-views";

export const dynamic = "force-dynamic";

type Params = Promise<{ ownerType: string; ownerId: string }>;

export default async function WatchOwnerDetailPage({ params }: { params: Params }) {
  const { ownerType, ownerId } = await params;
  const session = await getAdminSession();
  const canManage = canManageSmartwatches(session);
  const detail = await fetchWatchOwnerDetail(ownerType, ownerId);
  const inventory = await fetchWatchInventory({ ownerType, ownerId, limit: "25" });

  return (
    <AppShell>
      <PageHeader eyebrow="Devices" title={detail.ownerName} />
      <SmartwatchSubnav canManage={canManage} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Owner information">
          <dl className="grid gap-2 text-sm">
            <div><dt className="text-muted">Type</dt><dd>{detail.ownerType}</dd></div>
            <div><dt className="text-muted">ID</dt><dd className="font-mono">{detail.ownerId}</dd></div>
            <div><dt className="text-muted">Phone</dt><dd>{detail.phone ?? "—"}</dd></div>
            <div><dt className="text-muted">Email</dt><dd>{detail.email ?? "—"}</dd></div>
            <div><dt className="text-muted">Status</dt><dd>{detail.accountStatus ?? "—"}</dd></div>
          </dl>
        </Panel>
        <Panel title="Fleet summary">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted">Total</dt><dd className="text-lg font-semibold">{detail.totalWatches}</dd></div>
            <div><dt className="text-muted">Online</dt><dd>{detail.onlineWatches}</dd></div>
            <div><dt className="text-muted">Offline</dt><dd>{detail.offlineWatches}</dd></div>
            <div><dt className="text-muted">Low battery</dt><dd>{detail.lowBatteryWatches}</dd></div>
            <div><dt className="text-muted">SOS active</dt><dd>{detail.sosActiveWatches}</dd></div>
            <div><dt className="text-muted">Lost/stolen</dt><dd>{detail.lostStolenWatches}</dd></div>
          </dl>
        </Panel>
        <div className="lg:col-span-2">
        <Panel title="Watch inventory">
          <p className="mb-3 text-sm">
            <Link href={`/devices/smart-watches/fleet/inventory?ownerType=${encodeURIComponent(ownerType)}&ownerId=${encodeURIComponent(ownerId)}`} className="font-semibold text-eye hover:underline">
              View full paginated inventory ({detail.totalWatches})
            </Link>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                <tr><th className="px-3 py-2">Device</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Assignee</th><th className="px-3 py-2">Battery</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {inventory.data.map((row: WatchInventoryRowView) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2"><Link href={`/devices/smart-watches/${row.id}`} className="text-eye hover:underline">{row.deviceId}</Link></td>
                    <td className="px-3 py-2"><StatusBadge tone={row.onlineStatus === "Online" ? "success" : "warning"}>{row.onlineStatus}</StatusBadge></td>
                    <td className="px-3 py-2">{row.currentAssignee ?? "—"}</td>
                    <td className="px-3 py-2">{row.batteryLevel != null ? `${row.batteryLevel}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        </div>
        <div className="lg:col-span-2">
        <Panel title="Ownership history">
          <pre className="max-h-64 overflow-auto rounded bg-surfaceMuted p-3 text-xs">{JSON.stringify(detail.ownershipHistory?.slice(0, 10) ?? [], null, 2)}</pre>
        </Panel>
        </div>
        <div className="lg:col-span-2">
        <Panel title="Assignment history">
          <pre className="max-h-64 overflow-auto rounded bg-surfaceMuted p-3 text-xs">{JSON.stringify(detail.assignmentHistory?.slice(0, 10) ?? [], null, 2)}</pre>
        </Panel>
        </div>
        <div className="lg:col-span-2">
        <Panel title="Transfer history">
          <pre className="max-h-64 overflow-auto rounded bg-surfaceMuted p-3 text-xs">{JSON.stringify(detail.transferHistory?.slice(0, 10) ?? [], null, 2)}</pre>
        </Panel>
        </div>
      </div>
    </AppShell>
  );
}
