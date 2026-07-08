import { AppShell } from "../../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { volunteers } from "../../../lib/mock-data";

export default function VolunteersPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Emergency support network" title="Volunteer list" action={<StatusBadge tone="success">{volunteers.length} available</StatusBadge>} />
      <Panel title="Nearby volunteers">
        <div className="grid gap-3 md:grid-cols-3">{volunteers.map((volunteer) => <div key={volunteer.name} className="rounded-lg border border-line bg-slate-50 p-4"><p className="font-semibold">{volunteer.name}</p><p className="text-sm text-muted">{volunteer.type} - {volunteer.community}</p><div className="mt-3 flex gap-2"><StatusBadge tone="success">{volunteer.status}</StatusBadge><StatusBadge>{volunteer.distance}</StatusBadge></div></div>)}</div>
      </Panel>
    </AppShell>
  );
}
