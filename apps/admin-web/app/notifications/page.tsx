import { AppShell } from "../../components/app-shell";
import { MetricCard, PageHeader, Panel, StatusBadge } from "../../components/ui";
import { notificationOperations } from "../../lib/mock-data";

const types = ["EmergencyAlert", "IncidentStatusUpdate", "BroadcastAlert", "NearbyDangerWarning", "MissingPersonAlert", "StolenVehicleAlert", "FamilySosAlert", "AdminAssignmentAlert"];

export default function NotificationsPage() {
  const delivered = notificationOperations.filter((item) => item.status === "Delivered").length;
  const critical = notificationOperations.filter((item) => item.priority === "Critical").length;

  return (
    <AppShell>
      <PageHeader eyebrow="Multi-channel delivery" title="Notification system" action={<StatusBadge tone="success">FCM queue active</StatusBadge>} />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricCard label="Delivered" value={`${delivered}`} detail="Push and in-app confirmations" />
        <MetricCard label="Critical alerts" value={`${critical}`} detail="Emergency and family SOS" />
        <MetricCard label="Placeholder channels" value="SMS / Email" detail="Logged without live provider" />
      </div>

      <Panel title="Create targeted notification">
        <div className="grid gap-3 lg:grid-cols-[220px_180px_1fr_180px_180px_150px]">
          <select className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye">
            {types.map((type) => <option key={type}>{type}</option>)}
          </select>
          <select className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye">
            <option>Critical</option>
            <option>High</option>
            <option>Normal</option>
            <option>Low</option>
          </select>
          <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="Title" />
          <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="Lat, lng" />
          <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="Radius meters" />
          <button className="rounded-md bg-eye px-4 py-3 text-sm font-semibold text-white">Queue alert</button>
        </div>
      </Panel>

      <div className="mt-5">
        <Panel title="Delivery operations">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-muted">
                <tr><th className="px-4 py-3">Notification</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Channel</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Read</th><th className="px-4 py-3">Logs</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {notificationOperations.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3"><p className="font-semibold">{item.title}</p><p className="text-xs text-muted">{item.id}</p></td>
                    <td className="px-4 py-3">{item.type}</td>
                    <td className="px-4 py-3">{item.channel}</td>
                    <td className="px-4 py-3">{item.provider}</td>
                    <td className="px-4 py-3"><StatusBadge tone={item.priority === "Critical" ? "danger" : "warning"}>{item.priority}</StatusBadge></td>
                    <td className="px-4 py-3 text-muted">{item.target}</td>
                    <td className="px-4 py-3"><StatusBadge tone={item.status === "Delivered" ? "success" : "info"}>{item.status}</StatusBadge></td>
                    <td className="px-4 py-3">{item.read}</td>
                    <td className="px-4 py-3">{item.logs}</td>
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
