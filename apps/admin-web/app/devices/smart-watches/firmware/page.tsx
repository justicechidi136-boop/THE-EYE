import { AppShell } from "../../../../components/app-shell";
import { FirmwarePublishForm } from "../../../../components/smartwatch/firmware-publish-form";
import { SmartwatchSubnav } from "../../../../components/smartwatch/smartwatch-subnav";
import { PageHeader, Panel, StatusBadge } from "../../../../components/ui";
import { fetchFirmwareReleases } from "../../../../lib/api/data";
import { getAdminSession } from "../../../../lib/session";
import { canManageSmartwatches } from "../../../../lib/smartwatch-permissions";

export const dynamic = "force-dynamic";

export default async function SmartWatchFirmwarePage() {
  const session = await getAdminSession();
  const canManage = canManageSmartwatches(session);
  const firmwareReleases = canManage ? await fetchFirmwareReleases() : [];

  return (
    <AppShell>
      <PageHeader eyebrow="Devices" title="Firmware management" action={<StatusBadge tone="info">{firmwareReleases.length} releases</StatusBadge>} />
      <SmartwatchSubnav canManage={canManage} />
      <div className="grid gap-5">
        {!canManage ? (
          <Panel title="Firmware access">
            <div role="alert" className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
              Your admin account does not have permission to view or publish smartwatch firmware.
            </div>
          </Panel>
        ) : null}
        <Panel title="Publish signed firmware">
          <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            This publishes signed release metadata for eligible watches. The current watch app does not yet download or apply firmware, so publication must not be treated as device deployment.
          </div>
          <FirmwarePublishForm canManage={canManage} />
        </Panel>
        <Panel title="Release history">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                <tr><th className="px-4 py-3">Version</th><th className="px-4 py-3">Title</th><th className="px-4 py-3">Metadata status</th><th className="px-4 py-3">Signature metadata</th><th className="px-4 py-3">Retrievals started</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {firmwareReleases.length ? firmwareReleases.map((release) => (
                  <tr key={release.version}>
                    <td className="px-4 py-3 font-semibold">{release.version}</td>
                    <td className="px-4 py-3">{release.title}</td>
                    <td className="px-4 py-3"><StatusBadge tone={release.status === "Published" ? "success" : "neutral"}>{release.status}</StatusBadge></td>
                    <td className="px-4 py-3">{release.signature}</td>
                    <td className="px-4 py-3">{release.devices}</td>
                  </tr>
                )) : (
                  <tr><td className="px-4 py-6 text-muted" colSpan={5}>No firmware releases yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
