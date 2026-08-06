import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { ConsoleMetrics, ConsolePageHeader } from "../../../components/console";
import { StatusBadge } from "../../../components/ui";
import { fetchBroadcastAnalytics } from "../../../lib/api/data";
import { getRouteById } from "../../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

export default async function BroadcastAnalyticsPage() {
  const route = getRouteById("broadcast-analytics");
  const analytics = await fetchBroadcastAnalytics();

  return (
    <AppShell>
      <ConsolePageHeader
        title={route?.pageHeading ?? "Broadcast analytics"}
        eyebrow="Citizen and admin broadcast intelligence"
        breadcrumbs={route?.breadcrumb}
        action={<StatusBadge tone="success">{analytics.total} broadcasts in scope</StatusBadge>}
      />

      <ConsoleMetrics
        items={[
          { label: "Total broadcasts", value: String(analytics.total) },
          { label: "Citizen submitted", value: String(analytics.citizenSubmitted) },
          { label: "Admin verified", value: String(analytics.verified) },
          { label: "Suspended", value: String(analytics.suspended), detail: `${analytics.totalReports} total reports` },
          { label: "Comments", value: String(analytics.totalComments) },
          { label: "Reports", value: String(analytics.totalReports) },
        ]}
      />

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <h2 className="text-base font-semibold text-ink">By status</h2>
          <div className="mt-4 grid gap-2">
            {Object.entries(analytics.byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm">
                <span>{status}</span>
                <StatusBadge tone="info">{count}</StatusBadge>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <h2 className="text-base font-semibold text-ink">By category</h2>
          <div className="mt-4 grid gap-2">
            {Object.entries(analytics.byCategory).map(([category, count]) => (
              <div key={category} className="flex items-center justify-between rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm">
                <span>{category}</span>
                <StatusBadge tone="info">{count}</StatusBadge>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <h2 className="text-base font-semibold text-ink">By author type</h2>
          <div className="mt-4 grid gap-2">
            {Object.entries(analytics.byAuthorLabel).map(([authorLabel, count]) => (
              <div key={authorLabel} className="flex items-center justify-between rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm">
                <span>{authorLabel}</span>
                <StatusBadge tone="info">{count}</StatusBadge>
              </div>
            ))}
          </div>
          <Link href="/broadcasts" className="mt-4 inline-flex rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-accent">
            Back to workspace
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
