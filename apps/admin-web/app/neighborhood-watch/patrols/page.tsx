import { AppShell } from "../../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { patrolSchedules } from "../../../lib/mock-data";

export default function PatrolsPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Community patrol management" title="Patrol schedules" action={<StatusBadge tone="info">{patrolSchedules.length} schedules</StatusBadge>} />
      <Panel title="Patrols">
        <div className="grid gap-3">{patrolSchedules.map((patrol) => <div key={patrol.id} className="grid gap-2 rounded-lg border border-line bg-slate-50 p-4 md:grid-cols-[1fr_120px_140px_140px] md:items-center"><div><p className="font-semibold">{patrol.title}</p><p className="text-sm text-muted">{patrol.community}</p></div><StatusBadge tone={patrol.status === "Active" ? "success" : "info"}>{patrol.status}</StatusBadge><p className="text-sm">{patrol.volunteers} volunteers</p><p className="text-sm">{patrol.checkpoints} checkpoints</p></div>)}</div>
      </Panel>
    </AppShell>
  );
}
