import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";

export default function JobVacanciesPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Public recruitment" title="Job Vacancies" action={<StatusBadge tone="info">Module pending</StatusBadge>} />
      <Panel title="Recruitment module status">
        <p className="text-sm text-muted">
          Vacancy listings require a dedicated backend module (<code className="text-xs">GET /v1/job-vacancies</code>) that is not deployed yet.
          Operational admin workflows remain available through the links below.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/users" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm font-semibold transition-colors hover:border-eye">User directory</Link>
          <Link href="/roles" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm font-semibold transition-colors hover:border-eye">Roles & permissions</Link>
          <Link href="/agencies" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm font-semibold transition-colors hover:border-eye">Agency workload</Link>
          <Link href="/audit" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm font-semibold transition-colors hover:border-eye">Audit logs</Link>
        </div>
      </Panel>
    </AppShell>
  );
}
