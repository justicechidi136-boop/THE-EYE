import Link from "next/link";
import { humanPriority } from "../lib/admin-presentation";
import { formatReportCapturedAt, reportReporterLabel, reportTypeLabel } from "../lib/report-centre-presentation";
import type { Incident } from "../lib/types/admin-views";
import { StatusBadge } from "./ui";

function ReportSummary({ report }: { report: Incident }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold text-ink">{report.title}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{report.description || "No description supplied."}</p>
    </div>
  );
}

export function ReportCentreTable({ reports }: { reports: Incident[] }) {
  if (!reports.length) {
    return <div className="rounded-lg border border-dashed border-line bg-surfaceMuted px-6 py-10 text-center text-sm text-muted">No reports match the current search and filters.</div>;
  }

  return (
    <>
      <div className="grid gap-3 lg:hidden">
        {reports.map((report) => (
          <article key={report.id} className="min-w-0 rounded-lg border border-line bg-surfaceMuted p-4">
            <ReportSummary report={report} />
            <dl className="mt-4 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><dt className="text-xs text-muted">Type</dt><dd className="mt-1 break-words font-medium">{reportTypeLabel(report.type)}</dd></div>
              <div><dt className="text-xs text-muted">Priority</dt><dd className="mt-1">{humanPriority(report.priority)}</dd></div>
              <div><dt className="text-xs text-muted">Status</dt><dd className="mt-1 break-words">{report.status}</dd></div>
              <div><dt className="text-xs text-muted">Reporter</dt><dd className="mt-1 break-words">{reportReporterLabel(report)}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-muted">Location</dt><dd className="mt-1 break-words">{report.location}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-muted">Captured</dt><dd className="mt-1">{formatReportCapturedAt(report.createdAt)}</dd></div>
            </dl>
            <Link href={`/incidents/${report.id}`} className="mt-4 inline-flex rounded-md border border-eye px-3 py-2 text-sm font-semibold text-eye hover:bg-eye/10">View Report</Link>
          </article>
        ))}
      </div>
      <div data-admin-horizontal-scroll className="hidden overflow-x-auto rounded-lg border border-line lg:block">
        <table className="w-full min-w-[1120px] table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[20%]" /><col className="w-[9%]" /><col className="w-[8%]" /><col className="w-[9%]" />
            <col className="w-[12%]" /><col className="w-[16%]" /><col className="w-[15%]" /><col className="w-[11%]" />
          </colgroup>
          <thead className="bg-surfaceMuted text-xs uppercase tracking-wide text-muted">
            <tr>{["Report", "Type", "Priority", "Status", "Reporter", "Location", "Captured", "Action"].map((column) => <th key={column} className={column === "Action" ? "sticky right-0 bg-surfaceMuted px-3 py-3 font-semibold" : "px-3 py-3 font-semibold"}>{column}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {reports.map((report) => (
              <tr key={report.id} className="align-top hover:bg-surfaceMuted/70">
                <td className="px-3 py-3"><ReportSummary report={report} /></td>
                <td className="break-words px-3 py-3">{reportTypeLabel(report.type)}</td>
                <td className="px-3 py-3"><StatusBadge tone={report.priority === "P1" ? "danger" : report.priority === "P2" ? "warning" : "info"}>{humanPriority(report.priority)}</StatusBadge></td>
                <td className="break-words px-3 py-3">{report.status}</td>
                <td className="break-words px-3 py-3">{reportReporterLabel(report)}</td>
                <td className="break-words px-3 py-3"><span className="line-clamp-2">{report.location}</span></td>
                <td className="break-words px-3 py-3 text-muted">{formatReportCapturedAt(report.createdAt)}</td>
                <td className="sticky right-0 whitespace-nowrap bg-surface px-3 py-3"><Link href={`/incidents/${report.id}`} className="inline-flex min-h-10 items-center font-semibold text-eye hover:underline">View Report</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
