import Link from "next/link";
import { Suspense } from "react";
import { AppShell } from "../../components/app-shell";
import { IncidentMap } from "../../components/incident-widgets";
import {
  ConsoleDataTable,
  ConsoleFilterBar,
  ConsoleFilterSelect,
  ConsoleMetrics,
  ConsolePageHeader,
  ConsolePagination,
  ConsoleSearchInput,
} from "../../components/console";
import { StatusBadge } from "../../components/ui";
import { fetchIncidentsPage } from "../../lib/api/data";
import { getRouteById } from "../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

function priorityLabel(priority: string) {
  if (priority.startsWith("P1")) return "P1";
  if (priority.startsWith("P2")) return "P2";
  if (priority.startsWith("P3")) return "P3";
  return "P4";
}

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const route = getRouteById("incident-centre");
  const page = await fetchIncidentsPage({
    cursor: params.cursor,
    status: params.status,
    priority: params.priority,
    type: params.type,
  });

  const incidents = page.data;
  const p1Count = incidents.filter((incident) => incident.priority === "P1").length;
  const verifying = incidents.filter((incident) => incident.status === "Verifying").length;
  const nextHref = page.hasMore && page.nextCursor
    ? `/incidents?${new URLSearchParams({ ...params, cursor: page.nextCursor }).toString()}`
    : undefined;

  return (
    <AppShell>
      <ConsolePageHeader
        title={route?.pageHeading ?? "Incident Centre"}
        eyebrow="Jurisdiction filtered operational queue"
        breadcrumbs={route?.breadcrumb}
        action={<StatusBadge tone="info">{incidents.length} loaded</StatusBadge>}
      />
      <div className="grid gap-5">
        <ConsoleMetrics
          items={[
            { label: "Loaded incidents", value: String(incidents.length) },
            { label: "P1 life-threatening", value: String(p1Count) },
            { label: "Verifying", value: String(verifying) },
            { label: "Has more pages", value: page.hasMore ? "Yes" : "No" },
          ]}
        />
        <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          <Suspense fallback={null}>
            <ConsoleFilterBar>
              <ConsoleSearchInput name="q" label="Search loaded page" placeholder="Client-side filter not yet server-backed" defaultValue={params.q} />
              <ConsoleFilterSelect
                name="status"
                label="Status"
                defaultValue={params.status}
                options={[
                  { value: "Submitted", label: "Submitted" },
                  { value: "Received", label: "Received" },
                  { value: "Verifying", label: "Verifying" },
                  { value: "Verified", label: "Verified" },
                  { value: "Assigned", label: "Assigned" },
                  { value: "Responding", label: "Responding" },
                  { value: "Resolved", label: "Resolved" },
                  { value: "Closed", label: "Closed" },
                ]}
              />
              <ConsoleFilterSelect
                name="priority"
                label="Priority"
                defaultValue={params.priority}
                options={[
                  { value: "P1LifeThreatening", label: "P1" },
                  { value: "P2ActiveCrimeAccident", label: "P2" },
                  { value: "P3SuspiciousActivity", label: "P3" },
                  { value: "P4GeneralSafety", label: "P4" },
                ]}
              />
              <ConsoleFilterSelect
                name="type"
                label="Incident type"
                defaultValue={params.type}
                options={[
                  { value: "Emergency", label: "Emergency" },
                  { value: "MissingPerson", label: "Missing person" },
                  { value: "StolenVehicle", label: "Stolen vehicle" },
                  { value: "CommunitySafety", label: "Community safety" },
                ]}
              />
            </ConsoleFilterBar>
          </Suspense>
        </section>
        <IncidentMap incidents={incidents} />
        <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          <ConsoleDataTable
            columns={["Incident", "Type", "Priority", "Status", "Reporter", "Location", ""]}
            rows={incidents.map((incident) => [
              <div key={`title-${incident.id}`}>
                <p className="font-semibold">{incident.title}</p>
                <p className="text-xs text-muted">{incident.id}</p>
              </div>,
              incident.type,
              <StatusBadge key={`priority-${incident.id}`} tone={incident.priority === "P1" ? "danger" : incident.priority === "P2" ? "warning" : "info"}>
                {priorityLabel(incident.priority)}
              </StatusBadge>,
              incident.status,
              incident.reportingMode,
              incident.location,
              <Link key={`open-${incident.id}`} href={`/incidents/${incident.id}`} className="text-sm font-semibold text-eye hover:underline">
                Open
              </Link>,
            ])}
            emptyMessage="No incidents returned for the current admin scope."
          />
          <ConsolePagination hasMore={page.hasMore} nextHref={nextHref} />
        </section>
      </div>
    </AppShell>
  );
}
