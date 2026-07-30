import { AppShell } from "../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { fetchJurisdictionRows } from "../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function JurisdictionsPage() {
  const rows = await fetchJurisdictionRows();

  return (
    <AppShell>
      <PageHeader
        eyebrow="RBAC boundaries"
        title="Jurisdiction management"
        action={<StatusBadge tone="success">{rows.length} scoped areas</StatusBadge>}
      />
      <Panel title="Jurisdiction coverage">
        <p className="mb-4 text-sm text-muted">
          Derived from live community records, user directory scopes, and verified police station jurisdictions.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-surfaceMuted text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">LGA</th>
                <th className="px-4 py-3">Ward</th>
                <th className="px-4 py-3">Communities</th>
                <th className="px-4 py-3">Users</th>
                <th className="px-4 py-3">Police stations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length ? rows.map((row) => (
                <tr key={[row.country, row.state, row.lga, row.ward].join("-")}>
                  <td className="px-4 py-3">{row.country}</td>
                  <td className="px-4 py-3">{row.state}</td>
                  <td className="px-4 py-3">{row.lga}</td>
                  <td className="px-4 py-3">{row.ward}</td>
                  <td className="px-4 py-3 font-semibold">{row.communities}</td>
                  <td className="px-4 py-3">{row.users}</td>
                  <td className="px-4 py-3">{row.policeStations}</td>
                </tr>
              )) : (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={7}>No jurisdiction records in the current admin scope.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
