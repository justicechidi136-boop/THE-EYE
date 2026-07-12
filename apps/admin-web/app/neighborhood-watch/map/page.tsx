import { CsocMap } from "../../../components/csoc/csoc-map";
import { PageHeader, StatusBadge } from "../../../components/ui";
import { fetchCsocMapMarkers } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function CommunityMapPage() {
  const markers = await fetchCsocMapMarkers();

  return (
    <>
      <PageHeader
        eyebrow="PostGIS community map"
        title="Community Map"
        action={<StatusBadge tone="success">{markers.length} markers</StatusBadge>}
      />
      <CsocMap
        markers={markers}
        title="Interactive GIS — incidents, live videos, volunteers, patrols, SOS, police stations, smartwatches"
      />
    </>
  );
}
