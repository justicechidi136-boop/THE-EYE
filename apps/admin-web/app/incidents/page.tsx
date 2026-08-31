import Link from "next/link";
import { Suspense } from "react";
import { AppShell } from "../../components/app-shell";
import { ConsoleFilterBar, ConsoleFilterSelect, ConsoleMetrics, ConsolePageHeader, ConsoleSearchInput } from "../../components/console";
import { ReportCentreMap } from "../../components/report-centre-map";
import { ReportCentreTable } from "../../components/report-centre-table";
import { StatusBadge } from "../../components/ui";
import { fetchIncidentsPage } from "../../lib/api/data";
import { getRouteById } from "../../lib/admin/admin-route-registry";
import { encodeCursorHistory, parseCursorHistory, REPORT_TYPE_OPTIONS } from "../../lib/report-centre-presentation";

export const dynamic = "force-dynamic";

function pageHref(params: Record<string, string | undefined>, cursor: string | undefined, history: string[]) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "cursor" && key !== "history") next.set(key, value);
  }
  if (cursor) next.set("cursor", cursor);
  if (history.length) next.set("history", encodeCursorHistory(history));
  return `/incidents${next.size ? `?${next.toString()}` : ""}`;
}

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const route = getRouteById("incident-centre");
  const page = await fetchIncidentsPage({ cursor: params.cursor, status: params.status, priority: params.priority, type: params.type, q: params.q });
  const history = parseCursorHistory(params.history);
  const previousEntry = history.at(-1);
  const previousHref = previousEntry ? pageHref(params, previousEntry === "first" ? undefined : previousEntry, history.slice(0, -1)) : undefined;
  const nextHref = page.hasMore && page.nextCursor ? pageHref(params, page.nextCursor, [...history, params.cursor ?? "first"]) : undefined;
  const currentPage = history.length + 1;

  return (
    <AppShell>
      <ConsolePageHeader
        title={route?.pageHeading ?? "Report Centre"}
        eyebrow="Jurisdiction-filtered operational reports"
        breadcrumbs={route?.breadcrumb}
        action={<StatusBadge tone="info">{page.meta.totalReports} reports</StatusBadge>}
      />
      <div className="grid gap-5">
        <ConsoleMetrics items={[
          { label: "Total Reports", value: String(page.meta.totalReports) },
          { label: "Active Reports", value: String(page.meta.activeReports) },
          { label: "P1 / Critical", value: String(page.meta.criticalReports) },
          { label: "Verifying", value: String(page.meta.verifyingReports) },
        ]} />

        <section id="report-table" className="scroll-mt-4 rounded-lg border border-line bg-surface p-4 shadow-sm">
          <Suspense fallback={null}>
            <ConsoleFilterBar>
              <ConsoleSearchInput name="q" label="Search" placeholder="Search reports by title, reporter, or location…" defaultValue={params.q} />
              <ConsoleFilterSelect name="status" label="Status" defaultValue={params.status} options={[
                { value: "Submitted", label: "Submitted" }, { value: "Received", label: "Received" },
                { value: "Verifying", label: "Verifying" }, { value: "Verified", label: "Verified" },
                { value: "Assigned", label: "Assigned" }, { value: "Responding", label: "Responding" },
                { value: "Resolved", label: "Resolved" }, { value: "Closed", label: "Closed" },
              ]} />
              <ConsoleFilterSelect name="priority" label="Priority" defaultValue={params.priority} options={[
                { value: "P1LifeThreatening", label: "HIGH" }, { value: "P2ActiveCrimeAccident", label: "MID" },
                { value: "P3SuspiciousActivity", label: "LOW (suspicious activity)" }, { value: "P4GeneralSafety", label: "LOW (general safety)" },
              ]} />
              <ConsoleFilterSelect name="type" label="Report type" defaultValue={params.type} options={[...REPORT_TYPE_OPTIONS]} />
            </ConsoleFilterBar>
          </Suspense>
        </section>

        <ReportCentreMap reports={page.data} />

        <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          <ReportCentreTable reports={page.data} />
          <nav className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4" aria-label="Report pages">
            {previousHref ? <Link href={previousHref} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-eye">Previous</Link> : <span aria-disabled="true" className="cursor-not-allowed rounded-md border border-line px-3 py-2 text-sm font-semibold text-muted opacity-50">Previous</span>}
            <span className="text-sm font-semibold text-ink" aria-current="page">Page {currentPage}</span>
            {nextHref ? <Link href={nextHref} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-eye">Next</Link> : <span aria-disabled="true" className="cursor-not-allowed rounded-md border border-line px-3 py-2 text-sm font-semibold text-muted opacity-50">Next</span>}
          </nav>
        </section>
      </div>
    </AppShell>
  );
}
