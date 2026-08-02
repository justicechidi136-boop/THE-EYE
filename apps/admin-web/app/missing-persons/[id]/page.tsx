import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { MissingPersonDetailConsole } from "../../../components/cases/missing-person-detail-console";
import { ConsolePageHeader } from "../../../components/console";
import { StatusBadge } from "../../../components/ui";
import { fetchMissingPersonCase } from "../../../lib/api/data";
import { getRouteById } from "../../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

export default async function MissingPersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const route = getRouteById("missing-persons");
  const caseView = await fetchMissingPersonCase(id);

  if (!caseView) {
    return (
      <AppShell>
        <ConsolePageHeader title="Case not found" eyebrow="Missing person management" breadcrumbs={route?.breadcrumb} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ConsolePageHeader
        title={caseView.fullName}
        eyebrow="Missing person case"
        breadcrumbs={[...(route?.breadcrumb ?? []), caseView.fullName]}
        action={
          <div className="flex items-center gap-3">
            <Link href="/missing-persons" className="text-sm font-semibold text-eye hover:underline">All cases</Link>
            <StatusBadge tone={caseView.reportStatus === "Open" ? "warning" : "success"}>{caseView.reportStatus}</StatusBadge>
          </div>
        }
      />
      <MissingPersonDetailConsole caseView={caseView} />
    </AppShell>
  );
}
