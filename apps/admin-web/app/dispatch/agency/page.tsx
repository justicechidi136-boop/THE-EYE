import { AppShell } from "../../../components/app-shell";
import { PageHeader, Panel } from "../../../components/ui";
import { fetchDispatchIncidents, fetchDispatchResponders, type DispatchIncident, type DispatchResponder } from "../../../lib/api/dispatch";

export const dynamic = "force-dynamic";

export default async function AgencyDispatchPage() {
  const [assigned, responders] = await Promise.all([
    fetchDispatchIncidents({ status: "Assigned" }),
    fetchDispatchResponders(),
  ]);

  return (
    <AppShell>
      <PageHeader eyebrow="Agency dispatch" title="Agency operations" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Assigned incidents">
          <ul className="space-y-2">
            {(assigned.data ?? []).map((incident: DispatchIncident) => (
              <li key={incident.id} className="rounded-md border p-3 text-sm">
                <div className="font-medium">{incident.title}</div>
                <div>{incident.status} · {incident.priority}</div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Responder roster">
          <ul className="space-y-2">
            {(responders.data ?? []).map((responder: DispatchResponder) => (
              <li key={responder.id} className="rounded-md border p-3 text-sm">
                <div className="font-medium">{responder.displayName}</div>
                <div>{responder.availability}</div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}
