import { AppShell } from "../../components/app-shell";
import { PlaceholderNotice } from "../../components/placeholder-notice";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { PLACEHOLDER_DEPENDENCIES } from "../../lib/placeholder-dependencies";

const dependency = PLACEHOLDER_DEPENDENCIES.jurisdictions;

export default function JurisdictionsPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="RBAC boundaries" title="Jurisdiction management" action={<StatusBadge tone="success">Scoped access enforced</StatusBadge>} />
      <Panel title="Jurisdiction tree">
        <PlaceholderNotice title={dependency.title} endpoint={dependency.endpoint} note={dependency.note} />
        <p className="mt-4 text-sm text-muted">No jurisdiction records are shown until the backend exposes a listing endpoint.</p>
      </Panel>
    </AppShell>
  );
}
