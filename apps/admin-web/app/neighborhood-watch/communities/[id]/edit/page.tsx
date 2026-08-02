import { notFound } from "next/navigation";
import { CommunityFormConsole } from "../../../../../components/community/community-form-console";
import { ConsolePageHeader } from "../../../../../components/console";
import { fetchCommunityBoundary, fetchCommunityDetail } from "../../../../../lib/api/data";
import { getRouteById } from "../../../../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

export default async function EditCommunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const route = getRouteById("community-registry");
  const [detail, boundary] = await Promise.all([fetchCommunityDetail(id), fetchCommunityBoundary(id)]);
  if (!detail) notFound();

  const { community } = detail;

  return (
    <>
      <ConsolePageHeader
        title={`Edit ${community.name}`}
        eyebrow={route?.pageHeading ?? "Community registry"}
        breadcrumbs={[...(route?.breadcrumb ?? []), community.name, "Edit"]}
      />
      <CommunityFormConsole
        mode="edit"
        communityId={id}
        boundaryWkt={boundary?.wkt}
        areaSqM={boundary?.areaSqM}
        initial={{
          name: community.name,
          level: community.level,
          visibility: community.visibility,
          status: community.status ?? "Active",
          country: community.country ?? "",
          state: community.state ?? "",
          lga: community.lga ?? "",
          ward: "",
          estate: "",
          street: "",
          description: community.description ?? "",
          latitude: "",
          longitude: "",
          boundaryWkt: boundary?.wkt ?? "",
        }}
      />
    </>
  );
}
