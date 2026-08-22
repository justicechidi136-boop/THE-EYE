import Link from "next/link";
import { AppShell } from "../../../../components/app-shell";
import { SmartwatchSubnav } from "../../../../components/smartwatch/smartwatch-subnav";
import { WatchOwnerSummaryTable } from "../../../../components/smartwatch/watch-owner-summary-table";
import { PageHeader, Panel } from "../../../../components/ui";
import { fetchWatchOwnerSummaries } from "../../../../lib/api/data";
import { getAdminSession } from "../../../../lib/session";
import { canManageSmartwatches } from "../../../../lib/smartwatch-permissions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ cursor?: string; ownerType?: string; search?: string }>;

export default async function WatchFleetPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getAdminSession();
  const canManage = canManageSmartwatches(session);
  const params = await searchParams;
  const { data, nextCursor, hasMore } = canManage
    ? await fetchWatchOwnerSummaries(params)
    : { data: [], nextCursor: null, hasMore: false };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Devices"
        title="Standalone Watch Management"
        action={
          <Link href="/devices/smart-watches/fleet/inventory" className="text-sm font-semibold text-eye hover:underline">
            Full inventory
          </Link>
        }
      />
      <SmartwatchSubnav canManage={canManage} />
      <div className="grid gap-5">
        {!canManage ? (
          <Panel title="Fleet access">
            <div role="alert" className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
              Your admin account does not have permission to view smartwatch fleet ownership.
            </div>
          </Panel>
        ) : null}
        <Panel title="Owner summary">
          <WatchOwnerSummaryTable
            owners={data}
            nextCursor={nextCursor}
            hasMore={hasMore}
            searchParams={params}
          />
        </Panel>
      </div>
    </AppShell>
  );
}
