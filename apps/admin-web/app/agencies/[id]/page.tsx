import Link from "next/link";
import { notFound } from "next/navigation";
import { AgencyForm } from "../../../components/agencies/agency-form";
import { AgencyStatusActions } from "../../../components/agencies/agency-status-actions";
import { AppShell } from "../../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchAgency, listAgencies, listAgencyUnits } from "../../../lib/api/agencies";
import { canManageAgencies } from "../../../lib/agency-permissions";
import { getAdminSession } from "../../../lib/session";
import { formatJurisdiction } from "../../../lib/admin-presentation";

export const dynamic = "force-dynamic";

function formatAgencyType(type: string) {
  return type.replace(/_/g, " ");
}

export default async function AgencyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAdminSession();
  const canManage = canManageAgencies(session);
  const [agency, units, parentOptions] = await Promise.all([
    fetchAgency(id),
    listAgencyUnits(id),
    listAgencies({ isActive: "true" }),
  ]);
  if (!agency) notFound();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Responder network"
        title={agency.name}
        action={
          <StatusBadge tone={agency.isActive ? "success" : "danger"}>
            {agency.isActive ? "Active" : "Inactive"}
          </StatusBadge>
        }
      />
      <Link href="/agencies" className="mb-4 inline-block text-sm font-semibold text-eye hover:underline">
        Back to agency registry
      </Link>

      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-line bg-surfaceMuted p-4 text-sm">
          <p className="text-xs uppercase text-muted">Code</p>
          <p className="mt-1 font-semibold">{agency.code}</p>
        </div>
        <div className="rounded-lg border border-line bg-surfaceMuted p-4 text-sm">
          <p className="text-xs uppercase text-muted">Type</p>
          <p className="mt-1 font-semibold">{formatAgencyType(agency.agencyType)}</p>
        </div>
        <div className="rounded-lg border border-line bg-surfaceMuted p-4 text-sm">
          <p className="text-xs uppercase text-muted">Jurisdiction</p>
          <p className="mt-1 font-semibold">
            {formatJurisdiction([agency.countryCode, agency.stateCode, agency.lgaCode], "-")}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surfaceMuted p-4 text-sm">
          <p className="text-xs uppercase text-muted">Field operations</p>
          <p className="mt-1 font-semibold">{agency.isFieldOperationsEnabled ? "Enabled" : "Disabled"}</p>
        </div>
      </div>

      {canManage ? (
        <Panel title="Status">
          <AgencyStatusActions agencyId={agency.id} isActive={agency.isActive} />
        </Panel>
      ) : null}

      <Panel title={canManage ? "Edit agency" : "Agency details"}>
        {canManage ? (
          <AgencyForm mode="edit" agency={agency} parentOptions={parentOptions} />
        ) : (
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <p><span className="font-semibold">Name:</span> {agency.name}</p>
            <p><span className="font-semibold">Short name:</span> {agency.shortName || "-"}</p>
            <p><span className="font-semibold">Type:</span> {formatAgencyType(agency.agencyType)}</p>
            <p><span className="font-semibold">Jurisdiction level:</span> {agency.jurisdictionLevel}</p>
            <p><span className="font-semibold">Phone:</span> {agency.phone || "-"}</p>
            <p><span className="font-semibold">Email:</span> {agency.email || "-"}</p>
            <p className="md:col-span-2">
              <span className="font-semibold">Capabilities:</span>{" "}
              {agency.capabilities.length ? agency.capabilities.join(", ") : "None"}
            </p>
          </div>
        )}
      </Panel>

      <Panel title="Units">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surfaceMuted text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Identifier</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Jurisdiction</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {units.map((unit) => (
                <tr key={unit.id}>
                  <td className="px-4 py-3 font-semibold">{unit.name}</td>
                  <td className="px-4 py-3"><code className="text-xs">{unit.unitIdentifier}</code></td>
                  <td className="px-4 py-3">{unit.unitKind}</td>
                  <td className="px-4 py-3">
                    {formatJurisdiction([unit.countryCode, unit.stateCode, unit.lgaCode], "-")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={unit.isActive ? "success" : "danger"}>
                      {unit.isActive ? "Active" : "Inactive"}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
              {!units.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">No active units for this agency.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
