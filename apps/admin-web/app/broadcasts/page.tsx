import { AppShell } from "../../components/app-shell";
import { BroadcastWorkspace } from "../../components/broadcast/broadcast-workspace";
import { ConsolePageHeader } from "../../components/console";
import { fetchAdminBroadcastsPage, fetchBroadcastTargetOptions } from "../../lib/api/data";
import { getRouteById } from "../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

type BroadcastsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function dateRange(time?: string, customFrom?: string, customTo?: string) {
  const now = new Date();
  if (time === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: now.toISOString() };
  }
  if (time === "7d" || time === "30d") {
    const start = new Date(now);
    start.setDate(start.getDate() - (time === "7d" ? 7 : 30));
    return { from: start.toISOString(), to: now.toISOString() };
  }
  if (time === "custom") {
    const fromDate = customFrom ? new Date(`${customFrom}T00:00:00`) : undefined;
    const toDate = customTo ? new Date(`${customTo}T23:59:59.999`) : undefined;
    return {
      from: fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate.toISOString() : undefined,
      to: toDate && !Number.isNaN(toDate.getTime()) ? toDate.toISOString() : undefined,
    };
  }
  return {};
}

export default async function BroadcastsPage({ searchParams }: BroadcastsPageProps) {
  const route = getRouteById("broadcasts");
  const params = await searchParams;
  const time = readParam(params.time);
  const customFrom = readParam(params.from);
  const customTo = readParam(params.to);
  const range = dateRange(time, customFrom, customTo);
  const filters = {
    country: readParam(params.country),
    state: readParam(params.state),
    lga: readParam(params.lga),
    communityId: readParam(params.communityId),
    category: readParam(params.category),
    status: readParam(params.status),
    author: readParam(params.author),
    search: readParam(params.search),
    time,
    from: customFrom,
    to: customTo,
    page: readParam(params.page) ?? "1",
  };
  const [broadcastPage, targetOptions] = await Promise.all([
    fetchAdminBroadcastsPage({ ...filters, ...range, limit: "10" }),
    fetchBroadcastTargetOptions(),
  ]);

  return (
    <AppShell>
      <ConsolePageHeader
        title="Broadcasts"
        eyebrow="Location-based public messaging"
        breadcrumbs={route?.breadcrumb}
      />
      <BroadcastWorkspace
        broadcasts={broadcastPage.data}
        metrics={broadcastPage.meta}
        pagination={broadcastPage.pagination}
        targetOptions={targetOptions}
        filterDefaults={filters}
      />
    </AppShell>
  );
}
