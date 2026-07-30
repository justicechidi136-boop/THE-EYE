import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";

export default function SailingPermitPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Maritime safety" title="Sailing Permit" action={<StatusBadge tone="info">Module pending</StatusBadge>} />
      <Panel title="Permits module status">
        <p className="text-sm text-muted">
          Maritime permit applications require a dedicated backend module (<code className="text-xs">GET /v1/sailing-permits</code>) that is not deployed yet.
          Related safety workflows are available through incident and broadcast management.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/incidents" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm font-semibold transition-colors hover:border-eye">Incidents</Link>
          <Link href="/broadcasts" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm font-semibold transition-colors hover:border-eye">Broadcasts</Link>
          <Link href="/safety-alerts" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm font-semibold transition-colors hover:border-eye">Danger zones</Link>
          <Link href="/dispatch" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm font-semibold transition-colors hover:border-eye">Command center</Link>
        </div>
      </Panel>
    </AppShell>
  );
}
