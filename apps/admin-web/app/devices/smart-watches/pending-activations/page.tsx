import { AppShell } from "../../../../components/app-shell";
import { ActivateStandaloneWorkflow } from "../../../../components/smartwatch/activate-standalone-workflow";
import { PendingActivationsWorkspace } from "../../../../components/smartwatch/pending-activations-workspace";
import { SmartwatchSubnav } from "../../../../components/smartwatch/smartwatch-subnav";
import { PageHeader, Panel, StatusBadge } from "../../../../components/ui";
import { fetchActivationHistory, fetchPairingSessions } from "../../../../lib/api/data";
import { getAdminSession } from "../../../../lib/session";
import { canManageSmartwatches } from "../../../../lib/smartwatch-permissions";

export const dynamic = "force-dynamic";

export default async function PendingActivationsPage() {
  const session = await getAdminSession();
  const canManage = canManageSmartwatches(session);
  const sessions = await fetchPairingSessions();
  const pending = sessions.filter((sessionRow) => sessionRow.status === "pending");
  const history = await fetchActivationHistory();

  return (
    <AppShell>
      <PageHeader eyebrow="Devices" title="Pending activations" action={<StatusBadge tone="info">{pending.length} pending</StatusBadge>} />
      <SmartwatchSubnav canManage={canManage} />
      <div className="grid gap-5">
        <Panel title="Issue standalone activation">
          <ActivateStandaloneWorkflow canManage={canManage} />
        </Panel>
        <Panel title="Pending pairing sessions">
          <PendingActivationsWorkspace sessions={sessions} canManage={canManage} />
        </Panel>
        <Panel title="Activation audit history">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                <tr><th className="px-4 py-3">Action</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">When</th><th className="px-4 py-3">Metadata</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.length ? history.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 font-semibold">{entry.action}</td>
                    <td className="px-4 py-3">{entry.entityType} · {entry.entityId.slice(0, 8)}</td>
                    <td className="px-4 py-3">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-xs">{entry.metadata}</td>
                  </tr>
                )) : (
                  <tr><td className="px-4 py-6 text-muted" colSpan={4}>No activation audit entries yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
