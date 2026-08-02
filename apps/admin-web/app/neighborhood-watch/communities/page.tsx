import { Suspense } from "react";
import { CommunityRegistryConsole } from "../../../components/community/community-registry-console";
import { ConsolePageHeader } from "../../../components/console";
import { StatusBadge } from "../../../components/ui";
import { fetchCommunitiesPage } from "../../../lib/api/data";
import { getRouteById } from "../../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

export default async function CommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const route = getRouteById("community-registry");
  const page = await fetchCommunitiesPage({
    cursor: params.cursor,
    search: params.search ?? params.q,
    status: params.status ?? "all",
  });

  return (
    <>
      <ConsolePageHeader
        title={route?.pageHeading ?? "Community registry"}
        eyebrow="Community management workspace"
        breadcrumbs={route?.breadcrumb}
        action={<StatusBadge tone="success">{page.data.length} loaded</StatusBadge>}
      />
      <Suspense fallback={null}>
        <CommunityRegistryConsole
          communities={page.data}
          hasMore={page.hasMore}
          nextCursor={page.nextCursor ?? undefined}
          filters={{
            search: params.search ?? params.q,
            status: params.status ?? "all",
          }}
        />
      </Suspense>
    </>
  );
}
