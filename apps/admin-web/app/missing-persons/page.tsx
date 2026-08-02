import { Suspense } from "react";
import { AppShell } from "../../components/app-shell";
import { MissingPersonConsole } from "../../components/cases/missing-person-console";
import { ConsolePageHeader } from "../../components/console";
import { StatusBadge } from "../../components/ui";
import { fetchMissingPersonsPage } from "../../lib/api/data";
import { getRouteById } from "../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

export default async function MissingPersonsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const route = getRouteById("missing-persons");
  const page = await fetchMissingPersonsPage({
    cursor: params.cursor,
    q: params.q,
    status: params.status,
    reportStatus: params.reportStatus,
    priority: params.priority,
  });

  return (
    <AppShell>
      <ConsolePageHeader
        title={route?.pageHeading ?? "Missing person management"}
        eyebrow="Case management workspace"
        breadcrumbs={route?.breadcrumb}
        action={<StatusBadge tone="warning">{page.data.filter((item) => item.reportStatus === "Open").length} open</StatusBadge>}
      />
      <Suspense fallback={null}>
        <MissingPersonConsole
          cases={page.data}
          hasMore={page.hasMore}
          nextCursor={page.nextCursor ?? undefined}
          filters={{
            q: params.q,
            status: params.status,
            reportStatus: params.reportStatus,
            priority: params.priority,
          }}
        />
      </Suspense>
    </AppShell>
  );
}
