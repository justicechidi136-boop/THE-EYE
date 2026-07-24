import { notFound } from "next/navigation";
import { AppShell } from "../../../components/app-shell";
import { PoliceStationDetailClient } from "../../../components/police-stations/police-station-detail-client";
import { fetchPoliceStation } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function PoliceStationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const station = await fetchPoliceStation(id);
  if (!station) notFound();

  return (
    <AppShell>
      <PoliceStationDetailClient station={station} />
    </AppShell>
  );
}
