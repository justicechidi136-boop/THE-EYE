import { AppShell } from "../../components/app-shell";
import { PlaceholderNotice } from "../../components/placeholder-notice";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { PLACEHOLDER_DEPENDENCIES } from "../../lib/placeholder-dependencies";

const dependency = PLACEHOLDER_DEPENDENCIES.jobVacancies;

export default function JobVacanciesPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Public recruitment" title="Job Vacancies" action={<StatusBadge tone="info">Figma Other Services</StatusBadge>} />
      <Panel title="Open roles">
        <PlaceholderNotice title={dependency.title} endpoint={dependency.endpoint} note={dependency.note} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surfaceMuted text-xs uppercase text-muted">
              <tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Agency</th><th className="px-4 py-3">Applicants</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-6 text-muted" colSpan={5}>No vacancies returned. Waiting on backend module.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
