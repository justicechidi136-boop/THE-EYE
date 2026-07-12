import { Suspense } from "react";
import { AppShell } from "../../components/app-shell";
import { AuditFilter } from "../../components/audit-filter";
import { MetricCard, PageHeader, Panel, StatusBadge } from "../../components/ui";
import { fetchAuditLogs } from "../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entityType?: string; entityId?: string }>;
}) {
  const params = await searchParams;
  const { logs: auditLogs, chainVerified } = await fetchAuditLogs({
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
  });

  return (
    <AppShell>
      <PageHeader
        eyebrow="Immutable oversight ledger"
        title="Audit and accountability"
        action={<StatusBadge tone={chainVerified ? "success" : "danger"}>{chainVerified ? "Hash chain verified" : "Chain check failed"}</StatusBadge>}
      />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricCard label="Ledger events" value={`${auditLogs.length}`} detail="Append-only records shown" accent="eye" />
        <MetricCard label="Tamper status" value={chainVerified ? "Verified" : "Broken"} detail="Previous hash matches current chain" />
        <MetricCard label="Auditor access" value="Read-only" detail="No edit or delete actions exposed" />
      </div>

      <Panel title="Tamper-evident chain">
        <Suspense fallback={<p className="text-sm text-muted">Loading audit filters…</p>}>
          <AuditFilter logs={auditLogs} />
        </Suspense>
      </Panel>
    </AppShell>
  );
}
