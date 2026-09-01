import Link from "next/link";
import { AGENCY_TYPES } from "@the-eye/shared";
import { AppShell } from "../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { listAgencies } from "../../lib/api/agencies";
import { canManageAgencies } from "../../lib/agency-permissions";
import { getAdminSession } from "../../lib/session";

export const dynamic = "force-dynamic";

function formatAgencyType(type: string) {
  return type.replace(/_/g, " ");
}

export default async function AgenciesPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    agencyType?: string;
    isFieldOperationsEnabled?: string;
    isActive?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await getAdminSession();
  const canManage = canManageAgencies(session);
  const agencies = await listAgencies({
    search: params.search,
    agencyType: params.agencyType,
    isFieldOperationsEnabled: params.isFieldOperationsEnabled,
    isActive: params.isActive,
  });
  const activeCount = agencies.filter((agency) => agency.isActive).length;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Responder network"
        title="Agency registry"
        action={<StatusBadge tone="success">{activeCount} active · {agencies.length} total</StatusBadge>}
      />

      <Panel
        title="Agencies"
        aside={
          canManage ? (
            <Link
              href="/agencies/new"
              className="rounded-md bg-eye px-3 py-2 text-sm font-semibold text-white hover:bg-eyeDeep"
            >
              New agency
            </Link>
          ) : undefined
        }
      >
        <form
          className="mb-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.2fr)_minmax(180px,1fr)_minmax(200px,1fr)_minmax(150px,0.8fr)]"
          method="get"
        >
          <label className="grid min-w-0 gap-1 text-sm">
            <span className="font-medium text-ink">Search</span>
            <input
              name="search"
              defaultValue={params.search ?? ""}
              placeholder="Name or code"
              className="h-11 min-w-0 w-full max-w-full rounded-md border border-line bg-surface px-3 text-sm"
            />
          </label>
          <label className="grid min-w-0 gap-1 text-sm">
            <span className="font-medium text-ink">Type</span>
            <select
              name="agencyType"
              defaultValue={params.agencyType ?? ""}
              className="h-11 min-w-0 w-full max-w-full rounded-md border border-line bg-surface px-3 text-sm"
            >
              <option value="">All types</option>
              {AGENCY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatAgencyType(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-sm">
            <span className="font-medium text-ink">Field operations</span>
            <select
              name="isFieldOperationsEnabled"
              defaultValue={params.isFieldOperationsEnabled ?? ""}
              className="h-11 min-w-0 w-full max-w-full rounded-md border border-line bg-surface px-3 text-sm"
            >
              <option value="">Any</option>
              <option value="true">FO enabled</option>
              <option value="false">FO disabled</option>
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-sm">
            <span className="font-medium text-ink">Status</span>
            <select
              name="isActive"
              defaultValue={params.isActive ?? ""}
              className="h-11 min-w-0 w-full max-w-full rounded-md border border-line bg-surface px-3 text-sm"
            >
              <option value="">Any</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <div className="flex min-w-0 flex-wrap gap-2 sm:col-span-2 xl:col-span-4">
            <button type="submit" className="rounded-md bg-eye px-3 py-2 text-sm font-semibold text-white hover:bg-eyeDeep">
              Apply filters
            </button>
            <Link href="/agencies" className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:border-eye">
              Clear
            </Link>
          </div>
        </form>

        {!canManage ? (
          <p className="mb-4 text-sm text-muted">Your role can view agencies in scope. Creating or editing requires agency:manage.</p>
        ) : null}

        <div className="max-w-full min-w-0 overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-surfaceMuted text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Agency</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Jurisdiction</th>
                <th className="px-4 py-3">Capabilities</th>
                <th className="px-4 py-3">FO</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {agencies.map((agency) => (
                <tr key={agency.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/agencies/${agency.id}`}
                      className="font-semibold text-eyeOrange hover:underline focus-visible:outline-eyeOrange"
                    >
                      {agency.name}
                    </Link>
                    <p className="text-xs text-muted">{agency.code}</p>
                  </td>
                  <td className="px-4 py-3">{formatAgencyType(agency.agencyType)}</td>
                  <td className="px-4 py-3">
                    {[agency.countryCode, agency.stateCode, agency.lgaCode].filter(Boolean).join(" / ") || "-"}
                    <p className="text-xs text-muted">{agency.jurisdictionLevel}</p>
                  </td>
                  <td className="px-4 py-3">{agency.capabilities.length}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={agency.isFieldOperationsEnabled ? "success" : "info"}>
                      {agency.isFieldOperationsEnabled ? "Enabled" : "Off"}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={agency.isActive ? "success" : "danger"}>
                      {agency.isActive ? "Active" : "Inactive"}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
              {!agencies.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    No agencies match the current filters.
                    {canManage ? (
                      <>
                        {" "}
                        <Link href="/agencies/new" className="font-semibold text-eye hover:underline">
                          Create the first agency
                        </Link>
                      </>
                    ) : null}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
