import Link from "next/link";
import { AppShell } from "../../../../../components/app-shell";
import { SmartwatchSubnav } from "../../../../../components/smartwatch/smartwatch-subnav";
import { PageHeader, Panel, StatusBadge } from "../../../../../components/ui";
import { fetchWatchInventory, fetchWatchOwnerDetail } from "../../../../../lib/api/data";
import { getAdminSession } from "../../../../../lib/session";
import { canManageSmartwatches } from "../../../../../lib/smartwatch-permissions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ cursor?: string; ownerType?: string; ownerId?: string; search?: string; ownershipStatus?: string }>;

export default async function WatchFleetInventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getAdminSession();
  const canManage = canManageSmartwatches(session);
  const params = await searchParams;
  const { data, nextCursor, hasMore } = canManage
    ? await fetchWatchInventory(params)
    : { data: [], nextCursor: null, hasMore: false };
  const ownerDetail =
    params.ownerType && params.ownerId
      ? await fetchWatchOwnerDetail(params.ownerType, params.ownerId).catch(() => null)
      : null;

  return (
    <AppShell>
      <PageHeader eyebrow="Devices" title="Watch inventory" />
      <SmartwatchSubnav canManage={canManage} />
      {!canManage ? (
        <Panel title="Inventory access">
          <div role="alert" className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            Your admin account does not have permission to view smartwatch inventory.
          </div>
        </Panel>
      ) : null}
      {ownerDetail ? (
        <Panel title={`${ownerDetail.ownerName} — ${ownerDetail.totalWatches} watches`}>
          <p className="text-sm text-muted">
            <Link href={`/devices/smart-watches/fleet/owners/${encodeURIComponent(params.ownerType!)}/${encodeURIComponent(params.ownerId!)}`} className="text-eye hover:underline">
              View owner profile
            </Link>
          </p>
        </Panel>
      ) : null}
      <Panel title="Fleet inventory">
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <Link href="/devices/smart-watches/fleet/inventory" className="rounded border border-line px-2 py-1 hover:border-eye">
            All devices
          </Link>
          <Link
            href="/devices/smart-watches/fleet/inventory?ownershipStatus=REPLACEMENT_PENDING"
            className="rounded border border-amber-500/40 px-2 py-1 text-amber-300 hover:border-amber-400"
          >
            Replacement pending
          </Link>
          <Link
            href="/devices/smart-watches/fleet/inventory?ownershipStatus=LOST_OR_STOLEN"
            className="rounded border border-line px-2 py-1 hover:border-eye"
          >
            Lost / stolen
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1800px] text-left text-sm">
            <thead className="bg-surfaceMuted text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Watch</th>
                <th className="px-3 py-2">Device ID</th>
                <th className="px-3 py-2">Serial</th>
                <th className="px-3 py-2">IMEI</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Assignee</th>
                <th className="px-3 py-2">Org</th>
                <th className="px-3 py-2">Dept</th>
                <th className="px-3 py-2">Pairing</th>
                <th className="px-3 py-2">Ownership</th>
                <th className="px-3 py-2">Inventory</th>
                <th className="px-3 py-2">Online</th>
                <th className="px-3 py-2">Battery</th>
                <th className="px-3 py-2">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 font-semibold">
                    <Link href={`/devices/smart-watches/${row.id}`} className="text-eye hover:underline">{row.watchName}</Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.deviceId}</td>
                  <td className="px-3 py-2">{row.serialNumber ?? "—"}</td>
                  <td className="px-3 py-2">{row.imei ?? "—"}</td>
                  <td className="px-3 py-2">{row.model ?? "—"}</td>
                  <td className="px-3 py-2">{row.currentOwner}</td>
                  <td className="px-3 py-2">{row.currentAssignee ?? "—"}</td>
                  <td className="px-3 py-2">{row.organization ?? "—"}</td>
                  <td className="px-3 py-2">{row.department ?? "—"}</td>
                  <td className="px-3 py-2"><StatusBadge tone="info">{row.pairingStatus}</StatusBadge></td>
                  <td className="px-3 py-2">
                    {row.ownershipStatus === "REPLACEMENT_PENDING" ? (
                      <StatusBadge tone="warning">REPLACEMENT_PENDING</StatusBadge>
                    ) : (
                      row.ownershipStatus
                    )}
                  </td>
                  <td className="px-3 py-2">{row.inventoryStatus}</td>
                  <td className="px-3 py-2"><StatusBadge tone={row.onlineStatus === "Online" ? "success" : "warning"}>{row.onlineStatus}</StatusBadge></td>
                  <td className="px-3 py-2">{row.batteryLevel != null ? `${row.batteryLevel}%` : "—"}</td>
                  <td className="px-3 py-2 text-xs">{row.lastSeen ? new Date(row.lastSeen).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hasMore && nextCursor ? (
          <div className="border-t border-line p-4">
            <Link
              href={`/devices/smart-watches/fleet/inventory?${new URLSearchParams({ ...params, cursor: nextCursor } as Record<string, string>).toString()}`}
              className="text-sm font-semibold text-eye hover:underline"
            >
              Next page
            </Link>
          </div>
        ) : null}
      </Panel>
    </AppShell>
  );
}
