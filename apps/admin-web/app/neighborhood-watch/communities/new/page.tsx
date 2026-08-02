import { CommunityFormConsole } from "../../../../components/community/community-form-console";
import { ConsolePageHeader } from "../../../../components/console";
import { getAdminSession } from "../../../../lib/session";
import { getRouteById } from "../../../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

export default async function NewCommunityPage() {
  const route = getRouteById("community-registry");
  const session = await getAdminSession();

  return (
    <>
      <ConsolePageHeader
        title="Create community"
        eyebrow={route?.pageHeading ?? "Community registry"}
        breadcrumbs={[...(route?.breadcrumb ?? []), "Create"]}
      />
      <CommunityFormConsole
        mode="create"
        initial={{
          name: "",
          level: "Community",
          visibility: "Public",
          country: session?.country ?? "",
          state: session?.state ?? "",
          lga: session?.lga ?? "",
          ward: "",
          estate: "",
          street: "",
          description: "",
          latitude: "",
          longitude: "",
          boundaryWkt: "",
        }}
      />
    </>
  );
}
