import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { DroneSurveillanceSubnav } from "../../../components/drone/drone-surveillance-subnav";
import { EmptyState, TableScrollHint } from "../../../components/form-primitives";
import { MetricCard, PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchDroneOperatorsPage } from "../../../lib/api/data";
import {
  canCommandDroneMission,
  canCreateDroneOperator,
  canManageDroneFleet,
  canReadDroneOperators,
  canViewDroneSurveillance,
} from "../../../lib/drone-permissions";
import { getAdminSession } from "../../../lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  cursor?: string;
  q?: string;
  operatorRole?: string;
  accountStatus?: string;
  availabilityStatus?: string;
  licenceWarningLevel?: string;
}>;

function statusTone(value: string): "neutral" | "info" | "success" | "warning" | "danger" {
  const normalized = value.toLowerCase();
  if (normalized.includes("active") || normalized.includes("available")) return "success";
  if (normalized.includes("pending")) return "warning";
  if (normalized.includes("suspended") || normalized.includes("expired")) return "danger";
  if (normalized.includes("mission")) return "info";
  return "neutral";
}

export default async function DroneOperatorsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");
  if (!canReadDroneOperators(session)) redirect("/drone-surveillance");
  const params = await searchParams;
  const page = await fetchDroneOperatorsPage({
    cursor: params.cursor,
    q: params.q,
    operatorRole: params.operatorRole,
    accountStatus: params.accountStatus,
    availabilityStatus: params.availabilityStatus,
    licenceWarningLevel: params.licenceWarningLevel,
  }).catch(() => ({
    data: [],
    nextCursor: null,
    hasMore: false,
    limit: 25,
    stats: {
      total: 0,
      available: 0,
      onMission: 0,
      pending: 0,
      expiredLicences: 0,
      certsExpiring: 0,
      suspended: 0,
    },
  }));
  const canCreate = canCreateDroneOperator(session);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Drone Surveillance"
        title="Drone operator management"
        action={
          <div className="flex items-center gap-2">
            <StatusBadge tone="info">{page.stats.total} operators</StatusBadge>
            {canCreate ? (
              <Link href="/drone-surveillance/operators/new" className="rounded-md bg-eye px-3 py-2 text-sm font-semibold text-white hover:bg-eyeDeep">
                Add operator
              </Link>
            ) : null}
          </div>
        }
      />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total operators" value={String(page.stats.total)} />
        <MetricCard label="Available" value={String(page.stats.available)} accent="eye" />
        <MetricCard label="On mission" value={String(page.stats.onMission)} accent="eyeOrange" />
        <MetricCard label="Pending onboarding" value={String(page.stats.pending)} />
        <MetricCard label="Expired licences" value={String(page.stats.expiredLicences)} />
        <MetricCard label="Certs expiring soon" value={String(page.stats.certsExpiring)} />
        <MetricCard label="Suspended" value={String(page.stats.suspended)} />
      </div>
      <Panel title="Search and filters">
        <form method="GET" className="grid gap-3 md:grid-cols-5">
          <input name="q" defaultValue={params.q ?? ""} placeholder="Search name, code, callsign" className="h-11 rounded-md border border-line bg-surface px-3 text-sm text-ink md:col-span-2" />
          <select name="operatorRole" defaultValue={params.operatorRole ?? ""} className="h-11 rounded-md border border-line bg-surface px-3 text-sm text-ink">
            <option value="">All roles</option>
            <option value="Operator">Operator</option>
            <option value="Commander">Commander</option>
            <option value="Observer">Observer</option>
          </select>
          <select name="accountStatus" defaultValue={params.accountStatus ?? ""} className="h-11 rounded-md border border-line bg-surface px-3 text-sm text-ink">
            <option value="">All account statuses</option>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
            <option value="Suspended">Suspended</option>
            <option value="Inactive">Inactive</option>
          </select>
          <select name="availabilityStatus" defaultValue={params.availabilityStatus ?? ""} className="h-11 rounded-md border border-line bg-surface px-3 text-sm text-ink">
            <option value="">All availability</option>
            <option value="Available">Available</option>
            <option value="OnMission">On mission</option>
            <option value="Unavailable">Unavailable</option>
            <option value="OffDuty">Off duty</option>
          </select>
          <select name="licenceWarningLevel" defaultValue={params.licenceWarningLevel ?? ""} className="h-11 rounded-md border border-line bg-surface px-3 text-sm text-ink">
            <option value="">All licence alerts</option>
            <option value="none">No alert</option>
            <option value="warning">Warning</option>
            <option value="expired">Expired</option>
          </select>
          <div className="md:col-span-5">
            <button type="submit" className="rounded-md bg-eye px-4 py-2 text-sm font-semibold text-white hover:bg-eyeDeep">
              Apply filters
            </button>
          </div>
        </form>
      </Panel>
      <Panel title="Operator roster">
        {!page.data.length ? (
          <EmptyState title="No operators found" description="Try changing filters or add a new drone operator profile." />
        ) : (
          <div>
            <TableScrollHint />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1240px] text-left text-sm">
                <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Callsign</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Base</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Availability</th>
                    <th className="px-4 py-3">Licence</th>
                    <th className="px-4 py-3">Active assignments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {page.data.map((operator) => (
                    <tr key={operator.id}>
                      <td className="px-4 py-3 font-semibold">
                        <Link href={`/drone-surveillance/operators/${operator.id}`} className="text-eye hover:underline">
                          {operator.name}
                        </Link>
                        <p className="text-xs text-muted">{operator.email ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3">{operator.operatorCode ?? "—"}</td>
                      <td className="px-4 py-3">{operator.callsign ?? "—"}</td>
                      <td className="px-4 py-3">{operator.operatorRole}</td>
                      <td className="px-4 py-3">{[operator.lga, operator.state, operator.country].filter(Boolean).join(", ") || "—"}</td>
                      <td className="px-4 py-3">{operator.assignedOperatingBase ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={statusTone(operator.accountStatus)}>{operator.accountStatus}</StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={statusTone(operator.availabilityStatus)}>{operator.availabilityStatus}</StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={statusTone(operator.licenceWarningLevel)}>{operator.licenceWarningLevel}</StatusBadge>
                      </td>
                      <td className="px-4 py-3">{operator.activeAssignmentCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {page.hasMore && page.nextCursor ? (
              <div className="border-t border-line pt-4">
                <Link
                  href={`/drone-surveillance/operators?${new URLSearchParams({
                    ...params,
                    cursor: page.nextCursor,
                  } as Record<string, string>).toString()}`}
                  className="text-sm font-semibold text-eye hover:underline"
                >
                  Next page
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
