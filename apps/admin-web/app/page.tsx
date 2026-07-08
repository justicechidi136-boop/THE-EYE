import { AppShell } from "../components/app-shell";
import { IncidentMap, IncidentTable } from "../components/incident-widgets";
import { MetricCard, PageHeader, Panel, StatusBadge } from "../components/ui";
import { broadcasts, currentRole, incidents, roleScope } from "../lib/mock-data";

export default function DashboardPage() {
  const p1Count = incidents.filter((incident) => incident.priority === "P1").length;
  const verifyingCount = incidents.filter((incident) => incident.status === "Verifying").length;

  return (
    <AppShell>
      <PageHeader
        eyebrow={`${currentRole} command dashboard`}
        title="Live public safety operations"
        action={<StatusBadge tone="success">{roleScope[currentRole]}</StatusBadge>}
      />

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active incidents" value={String(incidents.length)} detail="Inside assigned jurisdiction" />
        <MetricCard label="P1 emergencies" value={String(p1Count)} detail="Immediate escalation enabled" />
        <MetricCard label="Verification queue" value={String(verifyingCount)} detail="System and crowd signals" />
        <MetricCard label="Broadcast approvals" value={String(broadcasts.length)} detail="Pending safety communications" />
      </section>

      <section className="mb-5 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <IncidentMap incidents={incidents} />
        <Panel title="Emergency priority queue">
          <div className="grid gap-3">
            {incidents.filter((incident) => incident.priority === "P1").map((incident) => (
              <div key={incident.id} className="rounded-lg border border-line bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{incident.title}</p>
                    <p className="mt-1 text-sm text-muted">{incident.assignedAgency}</p>
                  </div>
                  <StatusBadge tone="danger">{incident.priority}</StatusBadge>
                </div>
                <p className="mt-3 text-sm text-muted">{incident.responseStatus}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Panel title="Incident list">
        <IncidentTable incidents={incidents} />
      </Panel>
    </AppShell>
  );
}
