import Link from "next/link";
import type { WatchOwnerSummaryView } from "../../lib/types/admin-views";

type Props = {
  owners: WatchOwnerSummaryView[];
  nextCursor: string | null;
  hasMore: boolean;
  searchParams: Record<string, string | undefined>;
};

export function WatchOwnerSummaryTable({ owners, nextCursor, hasMore, searchParams }: Props) {
  const nextParams = nextCursor
    ? new URLSearchParams({ ...searchParams, cursor: nextCursor } as Record<string, string>).toString()
    : null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1400px] text-left text-sm">
        <thead className="bg-surfaceMuted text-xs uppercase text-muted">
          <tr>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">ID</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Organization</th>
            <th className="px-4 py-3">Assignee</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Online</th>
            <th className="px-4 py-3">Offline</th>
            <th className="px-4 py-3">Low batt.</th>
            <th className="px-4 py-3">SOS</th>
            <th className="px-4 py-3">Unassigned</th>
            <th className="px-4 py-3">Lost/Stolen</th>
            <th className="px-4 py-3">Last activity</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {owners.map((owner) => (
            <tr key={owner.ownerKey}>
              <td className="px-4 py-3 font-semibold">
                {owner.ownerId && owner.ownerType !== "Unassigned Inventory" ? (
                  <Link
                    href={`/devices/smart-watches/fleet/owners/${encodeURIComponent(owner.ownerType === "Person" ? "PERSON" : "ORGANIZATION")}/${encodeURIComponent(owner.ownerId)}`}
                    className="text-eye hover:underline"
                  >
                    {owner.ownerName}
                  </Link>
                ) : (
                  owner.ownerName
                )}
              </td>
              <td className="px-4 py-3">{owner.ownerType}</td>
              <td className="px-4 py-3 font-mono text-xs">{owner.ownerId ?? "—"}</td>
              <td className="px-4 py-3">{owner.phone ?? "—"}</td>
              <td className="px-4 py-3">{owner.email ?? "—"}</td>
              <td className="px-4 py-3">{owner.organization ?? "—"}</td>
              <td className="px-4 py-3">{owner.currentAssignee ?? "—"}</td>
              <td className="px-4 py-3">
                {owner.ownerId ? (
                  <Link
                    href={`/devices/smart-watches/fleet/inventory?ownerType=${encodeURIComponent(owner.ownerType === "Person" ? "PERSON" : owner.ownerType === "Organization" ? "ORGANIZATION" : "UNASSIGNED_INVENTORY")}&ownerId=${encodeURIComponent(owner.ownerId)}`}
                    className="font-semibold text-eye hover:underline"
                  >
                    {owner.totalWatches}
                  </Link>
                ) : (
                  owner.totalWatches
                )}
              </td>
              <td className="px-4 py-3">{owner.onlineWatches}</td>
              <td className="px-4 py-3">{owner.offlineWatches}</td>
              <td className="px-4 py-3">{owner.lowBatteryWatches}</td>
              <td className="px-4 py-3">{owner.sosActiveWatches}</td>
              <td className="px-4 py-3">{owner.unassignedWatches}</td>
              <td className="px-4 py-3">{owner.lostStolenWatches}</td>
              <td className="px-4 py-3 text-xs">{owner.lastDeviceActivity ? new Date(owner.lastDeviceActivity).toLocaleString() : "—"}</td>
              <td className="px-4 py-3">{owner.accountStatus ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && nextParams ? (
        <div className="border-t border-line p-4">
          <Link href={`/devices/smart-watches/fleet?${nextParams}`} className="text-sm font-semibold text-eye hover:underline">
            Load more owners
          </Link>
        </div>
      ) : null}
    </div>
  );
}
