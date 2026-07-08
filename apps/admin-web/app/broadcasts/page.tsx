import { AppShell } from "../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { broadcasts } from "../../lib/mock-data";

const types = ["Emergency", "Crime", "Accident", "Missing person", "Stolen vehicle", "Government alert", "Community warning"];

export default function BroadcastsPage() {
  const pending = broadcasts.filter((broadcast) => broadcast.status === "Pending approval").length;
  const published = broadcasts.filter((broadcast) => broadcast.status === "Published").length;

  return (
    <AppShell>
      <PageHeader eyebrow="Location-based public messaging" title="Broadcast system" action={<StatusBadge tone="warning">{pending} approvals pending</StatusBadge>} />
      <div className="grid gap-5">
        <section className="grid gap-4 md:grid-cols-3">
          <Panel title="Approval rules">
            <div className="grid gap-2 text-sm text-muted">
              <p>Government, community, missing person, and stolen vehicle broadcasts require admin approval.</p>
              <p>Verified critical P1 incidents can auto-publish to nearby users.</p>
            </div>
          </Panel>
          <Panel title="Geofence delivery">
            <div className="grid gap-2 text-sm text-muted">
              <p>PostGIS target areas and radius geofences filter recipients.</p>
              <p>Only users near the affected area receive push alerts.</p>
            </div>
          </Panel>
          <Panel title="Dispatch health">
            <div className="grid gap-3">
              <StatusBadge tone="success">{published} published</StatusBadge>
              <StatusBadge tone="info">FCM queue active</StatusBadge>
            </div>
          </Panel>
        </section>

        <Panel title="Create broadcast">
          <div className="grid gap-3 lg:grid-cols-[220px_1fr_1fr_180px]">
            <label className="grid gap-2 text-sm font-medium">
              Type
              <select className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye">
                {types.map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Title
              <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="Area safety alert" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Geofence
              <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="Lat, lng, radius or WKT area" />
            </label>
            <button className="self-end rounded-md bg-eye px-4 py-3 text-sm font-semibold text-white">Send for approval</button>
          </div>
        </Panel>

        <Panel title="Broadcast queue">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Broadcast</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Target geofence</th>
                  <th className="px-4 py-3">Approval</th>
                  <th className="px-4 py-3">Recipients</th>
                  <th className="px-4 py-3">Delivery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {broadcasts.map((broadcast) => (
                  <tr key={broadcast.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{broadcast.title}</p>
                      <p className="mt-1 text-xs text-muted">{broadcast.id} - {broadcast.author}</p>
                    </td>
                    <td className="px-4 py-3">{broadcast.type}</td>
                    <td className="px-4 py-3"><StatusBadge tone={broadcast.severity === "P1" ? "danger" : "warning"}>{broadcast.severity}</StatusBadge></td>
                    <td className="px-4 py-3 text-muted">{broadcast.target}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={broadcast.requiresApproval ? "warning" : "success"}>
                        {broadcast.requiresApproval ? broadcast.status : "Auto-broadcast"}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">{broadcast.recipients}</td>
                    <td className="px-4 py-3"><StatusBadge tone={broadcast.delivery === "Sent" ? "success" : "info"}>{broadcast.delivery}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
