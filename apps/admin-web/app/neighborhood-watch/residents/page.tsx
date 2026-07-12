import { CsocDataTable } from "../../../components/csoc/csoc-data-table";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchCommunityResidents } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function ResidentsPage() {
  const residents = await fetchCommunityResidents();
  const approved = residents.filter((r) => r.status === "Approved");
  const pending = residents.filter((r) => r.status === "Pending");

  return (
    <>
      <PageHeader
        eyebrow="Resident management"
        title="Residents"
        action={<StatusBadge tone="info">{approved.length} approved · {pending.length} pending</StatusBadge>}
      />
      <Panel title="Resident directory">
        <CsocDataTable
          columns={["Name", "Community", "Role", "Status", "Trust", "Volunteer", "Smartwatch", "Contact"]}
          rows={residents.map((r) => [
            r.name,
            r.community,
            r.role,
            <StatusBadge key={`s-${r.membershipId}`} tone={r.status === "Approved" ? "success" : r.status === "Pending" ? "warning" : "neutral"}>{r.status}</StatusBadge>,
            `${r.trustScore}%`,
            r.volunteerStatus,
            r.smartwatchStatus,
            <span key={`c-${r.membershipId}`} className="text-xs text-muted">{r.email}<br />{r.phone}</span>,
          ])}
          emptyMessage="No residents found in assigned communities."
        />
      </Panel>
    </>
  );
}
