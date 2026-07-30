import Link from "next/link";
import { ReportReviewButton } from "../../../components/csoc/report-review-button";
import { CsocDataTable } from "../../../components/csoc/csoc-data-table";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchAuditLogs, fetchCommunities, fetchContentReports, fetchPatrols, fetchVolunteers } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [communities, volunteers, patrols, audit, reports] = await Promise.all([
    fetchCommunities(),
    fetchVolunteers(),
    fetchPatrols(),
    fetchAuditLogs(),
    fetchContentReports(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Reporting"
        title="Reports"
        action={<StatusBadge tone="info">{reports.length} pending moderation reports</StatusBadge>}
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Live CSOC coverage">
          <div className="grid gap-2 text-sm">
            <p><strong>{communities.length}</strong> communities</p>
            <p><strong>{volunteers.length}</strong> volunteers</p>
            <p><strong>{patrols.length}</strong> patrol schedules</p>
            <p><strong>{audit.logs.length}</strong> recent audit events</p>
          </div>
        </Panel>
        <Panel title="Operational exports">
          <p className="text-sm text-muted">
            Use audit logs, incident lists, and broadcast history pages for operational review while scheduled PDF/Excel exports are planned.
          </p>
          <div className="mt-4 grid gap-2">
            <Link href="/audit" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm font-semibold transition-colors hover:border-eye">Audit logs</Link>
            <Link href="/neighborhood-watch/analytics" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm font-semibold transition-colors hover:border-eye">CSOC analytics</Link>
          </div>
        </Panel>
        <Panel title="Data sources">
          <p className="text-sm text-muted">
            Summary metrics use live endpoints: communities, patrols, volunteers, audit, and moderation reports.
          </p>
        </Panel>
      </div>
      <Panel title="Pending content moderation reports">
        <CsocDataTable
          columns={["Community", "Target", "Reason", "Status", "Submitted", "Actions"]}
          rows={reports.map((report) => [
            report.communityName,
            `${report.targetType} · ${report.targetId.slice(0, 8)}`,
            report.reasonCode,
            report.status,
            report.createdAt ? new Date(report.createdAt).toLocaleString() : "—",
            <div key={`actions-${report.id}`} className="flex gap-2">
              <ReportReviewButton reportId={report.id} action="reviewed" />
              <ReportReviewButton reportId={report.id} action="dismissed" />
            </div>,
          ])}
          emptyMessage="No pending moderation reports in scope."
        />
      </Panel>
    </>
  );
}
