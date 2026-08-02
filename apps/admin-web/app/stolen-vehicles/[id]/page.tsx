import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { StolenVehicleDetailConsole } from "../../../components/cases/stolen-vehicle-detail-console";
import { ConsolePageHeader } from "../../../components/console";
import { StatusBadge } from "../../../components/ui";
import { fetchStolenVehicleCase } from "../../../lib/api/data";
import { getRouteById } from "../../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

export default async function StolenVehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const route = getRouteById("stolen-vehicles");
  const caseView = await fetchStolenVehicleCase(id);

  if (!caseView) {
    return (
      <AppShell>
        <ConsolePageHeader title="Case not found" eyebrow="Stolen vehicle management" breadcrumbs={route?.breadcrumb} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ConsolePageHeader
        title={`${caseView.make} ${caseView.model}`}
        eyebrow={caseView.plateNumber}
        breadcrumbs={[...(route?.breadcrumb ?? []), caseView.plateNumber]}
        action={
          <div className="flex items-center gap-3">
            <Link href="/stolen-vehicles" className="text-sm font-semibold text-eye hover:underline">All cases</Link>
            <StatusBadge tone={caseView.reportStatus === "Open" ? "warning" : "success"}>{caseView.reportStatus}</StatusBadge>
          </div>
        }
      />
      <StolenVehicleDetailConsole caseView={caseView} />
    </AppShell>
  );
}
