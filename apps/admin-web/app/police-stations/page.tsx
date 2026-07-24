import { AppShell } from "../../components/app-shell";
import { PoliceStationWorkspace } from "../../components/police-stations/police-station-workspace";
import { PageHeader, StatusBadge } from "../../components/ui";
import { fetchPoliceStations } from "../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function PoliceStationsPage() {
  const policeStations = await fetchPoliceStations();
  return (
    <AppShell>
      <PageHeader
        eyebrow="PostGIS station locator"
        title="Police station management"
        action={<StatusBadge tone="success">{policeStations.length} stations</StatusBadge>}
      />
      <PoliceStationWorkspace initialStations={policeStations} />
    </AppShell>
  );
}
