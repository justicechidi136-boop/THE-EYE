import { AppShell } from "../../../components/app-shell";
import { BroadcastDetailWorkspace } from "../../../components/broadcast/broadcast-detail-workspace";
import { ConsoleEmptyState, ConsolePageHeader } from "../../../components/console";
import { StatusBadge } from "../../../components/ui";
import { getRouteById } from "../../../lib/admin/admin-route-registry";
import { humanPriority } from "../../../lib/admin-presentation";
import { fetchAdminBroadcast, fetchBroadcastReports } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

function authorTone(label: "Citizen" | "Admin" | "Verified"): "info" | "success" | "warning" {
  if (label === "Admin") return "info";
  if (label === "Verified") return "success";
  return "warning";
}

export default async function BroadcastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const route = getRouteById("broadcasts");
  const [broadcast, reports] = await Promise.all([fetchAdminBroadcast(id), fetchBroadcastReports(id)]);

  if (!broadcast) {
    return (
      <AppShell>
        <ConsolePageHeader title="Broadcast not found" eyebrow="Broadcast operations" breadcrumbs={[...(route?.breadcrumb ?? []), "Details"]} action={<StatusBadge tone="warning">Missing</StatusBadge>} />
        <ConsoleEmptyState title="Broadcast not found" detail="The broadcast may be outside your jurisdiction or no longer available." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ConsolePageHeader
        title="Broadcast Details"
        eyebrow={broadcast.title}
        breadcrumbs={[...(route?.breadcrumb ?? []), "Details"]}
        action={<div className="flex flex-wrap gap-2"><StatusBadge tone={authorTone(broadcast.authorLabel)}>{broadcast.authorLabel}</StatusBadge><StatusBadge tone="info">{broadcast.status}</StatusBadge><StatusBadge tone={humanPriority(broadcast.severity) === "HIGH" ? "danger" : humanPriority(broadcast.severity) === "MID" ? "warning" : "neutral"}>{humanPriority(broadcast.severity)}</StatusBadge></div>}
      />
      <BroadcastDetailWorkspace broadcast={broadcast} reports={reports} />
    </AppShell>
  );
}
