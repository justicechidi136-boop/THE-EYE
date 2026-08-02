import { Suspense } from "react";
import { VolunteerNetworkConsole } from "../../../components/community/volunteer-network-console";
import { ConsolePageHeader } from "../../../components/console";
import { StatusBadge } from "../../../components/ui";
import { fetchCommunities, fetchVolunteers } from "../../../lib/api/data";
import { getRouteById } from "../../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

export default async function VolunteerNetworkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const route = getRouteById("volunteers");
  const [volunteers, communities] = await Promise.all([fetchVolunteers(), fetchCommunities()]);
  const filteredVolunteers = params.status
    ? volunteers.filter((volunteer) => volunteer.status === params.status)
    : volunteers;

  return (
    <>
      <ConsolePageHeader
        title={route?.pageHeading ?? "Volunteer network"}
        eyebrow="Verification, availability, and community assignment"
        breadcrumbs={route?.breadcrumb}
        action={<StatusBadge tone="success">{filteredVolunteers.length} volunteers</StatusBadge>}
      />
      <Suspense fallback={null}>
        <VolunteerNetworkConsole volunteers={filteredVolunteers} communities={communities} filters={{ q: params.q, status: params.status }} />
      </Suspense>
    </>
  );
}
