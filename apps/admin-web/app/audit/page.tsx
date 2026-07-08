import { AppShell } from "../../components/app-shell";
import { MetricCard, PageHeader, Panel, StatusBadge } from "../../components/ui";
import { auditLogs } from "../../lib/mock-data";

export default function AuditPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Immutable oversight ledger" title="Audit and accountability" action={<StatusBadge tone="success">Hash chain verified</StatusBadge>} />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricCard label="Ledger events" value={`${auditLogs.length}`} detail="Append-only records shown" />
        <MetricCard label="Tamper status" value="Verified" detail="Previous hash matches current chain" />
        <MetricCard label="Auditor access" value="Read-only" detail="No edit or delete actions exposed" />
      </div>

      <Panel title="Filters">
        <div className="grid gap-3 md:grid-cols-4">
          <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="Action" />
          <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="Entity type" />
          <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="Entity ID" />
          <button className="rounded-md bg-eye px-4 py-3 text-sm font-semibold text-white">Search ledger</button>
        </div>
      </Panel>

      <div className="mt-5">
        <Panel title="Tamper-evident chain">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-muted">
                <tr><th className="px-4 py-3">Seq</th><th className="px-4 py-3">Time</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Previous hash</th><th className="px-4 py-3">Event hash</th><th className="px-4 py-3">Chain</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {auditLogs.map((log) => (
                  <tr key={log.sequence}>
                    <td className="px-4 py-3 font-semibold">{log.sequence}</td>
                    <td className="px-4 py-3">{log.time}</td>
                    <td className="px-4 py-3">{log.actor}</td>
                    <td className="px-4 py-3">{log.action}</td>
                    <td className="px-4 py-3 font-semibold">{log.entity}</td>
                    <td className="px-4 py-3 text-muted">{log.reason}</td>
                    <td className="px-4 py-3 font-mono text-xs">{log.previousHash}</td>
                    <td className="px-4 py-3 font-mono text-xs">{log.eventHash}</td>
                    <td className="px-4 py-3"><StatusBadge tone="success">{log.chain}</StatusBadge></td>
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
