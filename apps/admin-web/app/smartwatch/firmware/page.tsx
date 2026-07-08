import { AppShell } from "../../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { firmwareReleases } from "../../../lib/mock-data";

export default function WatchFirmwarePage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Signed firmware management" title="Watch firmware" action={<StatusBadge tone="info">{firmwareReleases.length} releases</StatusBadge>} />
      <div className="grid gap-5">
        <Panel title="Publish firmware">
          <div className="grid gap-3 lg:grid-cols-[160px_1fr_1fr_1fr_150px]">
            <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="Version" />
            <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="Download URL" />
            <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="SHA-256 hash" />
            <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="Signature" />
            <button className="rounded-md bg-eye px-4 py-3 text-sm font-semibold text-white">Publish</button>
          </div>
        </Panel>
        <Panel title="Release history">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-muted">
                <tr><th className="px-4 py-3">Version</th><th className="px-4 py-3">Title</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Signature</th><th className="px-4 py-3">Devices</th><th className="px-4 py-3">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {firmwareReleases.map((release) => (
                  <tr key={release.version}>
                    <td className="px-4 py-3 font-semibold">{release.version}</td>
                    <td className="px-4 py-3">{release.title}</td>
                    <td className="px-4 py-3"><StatusBadge tone={release.status === "Published" ? "success" : "neutral"}>{release.status}</StatusBadge></td>
                    <td className="px-4 py-3">{release.signature}</td>
                    <td className="px-4 py-3">{release.devices}</td>
                    <td className="px-4 py-3"><button className="rounded-md border border-line px-3 py-2 text-xs font-semibold">Schedule update</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
