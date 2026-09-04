import { Suspense } from "react";
import { AppShell } from "../../components/app-shell";
import { ConsoleFilterBar, ConsoleFilterSelect, ConsoleMetrics, ConsolePageHeader, ConsolePagination, ConsoleSearchInput } from "../../components/console";
import { ReportCentreMap } from "../../components/report-centre-map";
import { ReportCentreTable } from "../../components/report-centre-table";
import { StatusBadge } from "../../components/ui";
import { fetchIncidents, fetchIncidentsPage } from "../../lib/api/data";
import { getRouteById } from "../../lib/admin/admin-route-registry";
import { reportPaginationItems, REPORT_TYPE_OPTIONS } from "../../lib/report-centre-presentation";

export const dynamic = "force-dynamic";

function pageHref(params: Record<string, string | undefined>, page: number, limit: number) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && !["cursor", "history", "page", "limit"].includes(key)) next.set(key, value);
  }
  next.set("page", String(page));
  next.set("limit", String(limit));
  return `/incidents?${next.toString()}`;
}

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const route = getRouteById("incident-centre");
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedLimit = Number.parseInt(params.limit ?? "20", 10);
  const pageSize = [20, 50, 100].includes(requestedLimit) ? requestedLimit : 20;
  const filters = { status: params.status, priority: params.priority, type: params.type, q: params.q };
  const [page, mappedReports] = await Promise.all([
    fetchIncidentsPage({ ...filters, page: String(currentPage), limit: String(pageSize) }),
    fetchIncidents(filters),
  ]);
  const totalPages = page.totalPages ?? Math.max(1, Math.ceil(page.meta.totalReports / pageSize));
  const previousHref = currentPage > 1 ? pageHref(params, currentPage - 1, pageSize) : undefined;
  const nextHref = currentPage < totalPages ? pageHref(params, currentPage + 1, pageSize) : undefined;
  const pageLinks = reportPaginationItems(currentPage, totalPages).map((item) => item === "ellipsis"
    ? { label: "…" }
    : { label: String(item), href: pageHref(params, item, pageSize), current: item === currentPage });
  const pageSizeLinks = [20, 50, 100].map((size) => ({ size, href: pageHref(params, 1, size), current: size === pageSize }));

  return (
    <AppShell>
      <ConsolePageHeader
        title={route?.pageHeading ?? "Report Centre"}
        eyebrow="Jurisdiction-filtered operational reports"
        breadcrumbs={route?.breadcrumb}
        action={<StatusBadge tone="info">{page.meta.totalReports} reports</StatusBadge>}
      />
      <div className="grid min-w-0 max-w-full gap-5">
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
                { value: "Ended", label: "Ended" }, { value: "Resolved", label: "Resolved" }, { value: "Closed", label: "Closed" },
              ]} />
              <ConsoleFilterSelect name="priority" label="Priority" defaultValue={params.priority} options={[
                { value: "P1LifeThreatening", label: "HIGH" }, { value: "P2ActiveCrimeAccident", label: "MID" },
                { value: "P3SuspiciousActivity", label: "LOW (suspicious activity)" }, { value: "P4GeneralSafety", label: "LOW (general safety)" },
              ]} />
              <ConsoleFilterSelect name="type" label="Report type" defaultValue={params.type} options={[...REPORT_TYPE_OPTIONS]} />
            </ConsoleFilterBar>
          </Suspense>
        </section>

        <ReportCentreMap reports={mappedReports} />

        <section className="min-w-0 max-w-full rounded-lg border border-line bg-surface p-4 shadow-sm">
          <ReportCentreTable reports={page.data} />
          <div data-onscreen-navigation-avoid className="relative z-50 bg-surface">
            <ConsolePagination currentPage={currentPage} totalItems={page.meta.totalReports} pageSize={pageSize} previousHref={previousHref} nextHref={nextHref} pageLinks={pageLinks} pageSizeLinks={pageSizeLinks} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
