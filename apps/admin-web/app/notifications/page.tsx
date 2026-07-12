import { AppShell } from "../../components/app-shell";
import { NotificationComposeForm } from "../../components/notification-compose-form";
import { MetricCard, PageHeader, Panel, StatusBadge } from "../../components/ui";
import { fetchNotificationOperations } from "../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const notificationOperations = await fetchNotificationOperations();
  const delivered = notificationOperations.filter((item) => item.status === "Delivered").length;
  const critical = notificationOperations.filter((item) => item.priority === "Critical" || item.priority === "P1LifeThreatening").length;

  return (
    <AppShell>
      <PageHeader eyebrow="Multi-channel delivery" title="Notification system" action={<StatusBadge tone="success">API connected</StatusBadge>} />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricCard label="Delivered" value={`${delivered}`} detail="Push and in-app confirmations" />
        <MetricCard label="Critical alerts" value={`${critical}`} detail="Emergency and family SOS" />
        <MetricCard label="Queue source" value="Redis/BullMQ" detail="Loaded from `/v1/notifications`" />
      </div>

      <Panel title="Create targeted notification">
        <NotificationComposeForm />
      </Panel>

      <div className="mt-5">
        <Panel title="Delivery operations">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                <tr><th className="px-4 py-3">Notification</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Channel</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Read</th><th className="px-4 py-3">Logs</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {notificationOperations.length ? notificationOperations.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3"><p className="font-semibold">{item.title}</p><p className="text-xs text-muted">{item.id}</p></td>
                    <td className="px-4 py-3">{item.type}</td>
                    <td className="px-4 py-3">{item.channel}</td>
                    <td className="px-4 py-3">{item.provider}</td>
                    <td className="px-4 py-3"><StatusBadge tone={item.priority === "Critical" || item.priority === "P1LifeThreatening" ? "danger" : "warning"}>{item.priority}</StatusBadge></td>
                    <td className="px-4 py-3 text-muted">{item.target}</td>
                    <td className="px-4 py-3"><StatusBadge tone={item.status === "Delivered" ? "success" : "info"}>{item.status}</StatusBadge></td>
                    <td className="px-4 py-3">{item.read}</td>
                    <td className="px-4 py-3">{item.logs}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-4 py-6 text-muted" colSpan={9}>No notifications returned from the API. Dispatch events will appear here once producers enqueue alerts.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
