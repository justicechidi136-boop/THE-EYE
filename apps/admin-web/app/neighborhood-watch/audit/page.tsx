import { AuditFilter } from "../../../components/audit-filter";
import { CsocDataTable } from "../../../components/csoc/csoc-data-table";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchAuditLogs } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function CsocAuditPage() {
  const audit = await fetchAuditLogs();
  const communityLogs = audit.logs.filter((log) =>
    log.action.startsWith("community.") ||
    ["admin.login", "broadcast.", "incident."].some((prefix) => log.action.startsWith(prefix)),
  );

  return (
    <>
      <PageHeader
        eyebrow="Audit & compliance"
        title="Audit Logs"
        action={<StatusBadge tone={audit.chainVerified ? "success" : "warning"}>Chain {audit.chainVerified ? "verified" : "unverified"}</StatusBadge>}
      />
      <AuditFilter logs={communityLogs} />
      <Panel title="Community & security audit trail">
        <CsocDataTable
          columns={["Time", "Actor", "Action", "Entity", "Chain"]}
          rows={communityLogs.slice(0, 50).map((log) => [
            log.time,
            log.actor,
            log.action,
            log.entity,
            <StatusBadge key={`c-${log.sequence}`} tone={log.chain === "Verified" ? "success" : "neutral"}>{log.chain}</StatusBadge>,
          ])}
          emptyMessage="No audit logs in jurisdiction."
        />
      </Panel>
    </>
  );
}
