import { Suspense } from "react";
import { MembershipApprovalConsole } from "../../../components/community/membership-approval-console";
import { ConsolePageHeader } from "../../../components/console";
import { StatusBadge } from "../../../components/ui";
import { fetchAdminMembershipsPage } from "../../../lib/api/data";
import { getRouteById } from "../../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const route = getRouteById("membership-approval");
  const page = await fetchAdminMembershipsPage({
    cursor: params.cursor,
    q: params.q,
    status: params.status,
    communityId: params.communityId,
  });

  return (
    <>
      <ConsolePageHeader
        title={route?.pageHeading ?? "Membership approval"}
        eyebrow="Resident onboarding and moderation"
        breadcrumbs={route?.breadcrumb}
        action={<StatusBadge tone="warning">{page.data.filter((row) => row.status === "Pending").length} pending</StatusBadge>}
      />
      <Suspense fallback={null}>
        <MembershipApprovalConsole
          memberships={page.data}
          hasMore={page.hasMore}
          nextCursor={page.nextCursor ?? undefined}
          filters={{ q: params.q, status: params.status, communityId: params.communityId }}
        />
      </Suspense>
    </>
  );
}
