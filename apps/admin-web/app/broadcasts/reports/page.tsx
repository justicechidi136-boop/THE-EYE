import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { ConsoleEmptyState, ConsolePageHeader } from "../../../components/console";
import { StatusBadge } from "../../../components/ui";
import { fetchAdminBroadcasts } from "../../../lib/api/data";
import { getRouteById } from "../../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

export default async function BroadcastReportsPage() {
  const route = getRouteById("broadcast-reports");
  const broadcasts = await fetchAdminBroadcasts({ limit: "100" });
  const flagged = broadcasts.filter((broadcast) => broadcast.reportCount > 0);

  return (
    <AppShell>
      <ConsolePageHeader
        title={route?.pageHeading ?? "Broadcast reports"}
        eyebrow="Citizen moderation queue"
        breadcrumbs={route?.breadcrumb}
        action={<StatusBadge tone="warning">{flagged.length} broadcasts with reports</StatusBadge>}
      />

      {!flagged.length ? (
        <ConsoleEmptyState title="No broadcast reports in scope" detail="Citizen reports will appear here when users flag broadcasts in your jurisdiction." />
      ) : (
        <section className="rounded-lg border border-line bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-0 text-left text-sm">
              <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Broadcast</th>
                  <th className="px-4 py-3">Author</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reports</th>
                  <th className="px-4 py-3">Comments</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {flagged.map((broadcast) => (
                  <tr key={broadcast.id}>
                    <td className="px-4 py-3">
                      <Link href={`/broadcasts/${broadcast.id}`} className="font-semibold text-accent hover:underline">
                        {broadcast.title}
                      </Link>
                      <p className="mt-1 text-xs text-muted">{broadcast.id}</p>
                    </td>
                    <td className="px-4 py-3">{broadcast.authorLabel}</td>
                    <td className="px-4 py-3">{broadcast.status}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone="warning">{broadcast.reportCount}</StatusBadge>
                    </td>
                    <td className="px-4 py-3">{broadcast.commentCount}</td>
                    <td className="px-4 py-3">
                      <Link href={`/broadcasts/${broadcast.id}`} className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:border-accent">
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AppShell>
  );
}
