import { CsocApiNotice } from "../../../components/csoc/csoc-data-table";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchAuditLogs, fetchCommunities, fetchPatrols, fetchVolunteers } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

const REPORT_TYPES = [
  "Daily Report", "Weekly Report", "Monthly Report", "Community Report",
  "Volunteer Report", "Patrol Report", "Crime Report", "Broadcast Report",
];

const EXPORT_FORMATS = ["PDF", "Excel", "CSV"];

export default async function ReportsPage() {
  const [communities, volunteers, patrols, audit] = await Promise.all([
    fetchCommunities(),
    fetchVolunteers(),
    fetchPatrols(),
    fetchAuditLogs(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Reporting"
        title="Reports"
        action={<StatusBadge tone="info">{audit.logs.length} audit events</StatusBadge>}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Report types">
          <ul className="grid gap-2">
            {REPORT_TYPES.map((type) => (
              <li key={type} className="rounded-lg border border-line bg-surfaceMuted px-4 py-3 text-sm font-semibold">{type}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="Export formats">
          <div className="flex flex-wrap gap-2">
            {EXPORT_FORMATS.map((fmt) => (
              <span key={fmt} className="rounded-md border border-line bg-surfaceMuted px-4 py-2 text-sm font-semibold">{fmt}</span>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">
            Live data available: {communities.length} communities, {volunteers.length} volunteers, {patrols.length} patrols.
          </p>
        </Panel>
      </div>
      <CsocApiNotice
        notice={{
          title: "Scheduled report generation",
          endpoint: "POST /v1/reports/generate",
          note: "Automated PDF/Excel/CSV export requires a reports generation endpoint. Summary metrics above use live CSOC data.",
        }}
      />
    </>
  );
}
