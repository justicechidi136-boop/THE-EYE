import { CsocDataTable } from "../../../components/csoc/csoc-data-table";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchVolunteers } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

const VOLUNTEER_CATEGORIES = [
  "Doctor", "Nurse", "Lawyer", "Fire Volunteer", "Security Volunteer",
  "Search & Rescue", "Blood Donor", "Mechanical Rescue",
];

export default async function VolunteerNetworkPage() {
  const volunteers = await fetchVolunteers();

  return (
    <>
      <PageHeader
        eyebrow="Volunteer network"
        title="Volunteer Network"
        action={<StatusBadge tone="success">{volunteers.length} volunteers</StatusBadge>}
      />
      <Panel title="Volunteer categories">
        <div className="mb-4 flex flex-wrap gap-2">
          {VOLUNTEER_CATEGORIES.map((cat) => (
            <span key={cat} className="rounded-md border border-line bg-surfaceMuted px-3 py-1 text-xs font-semibold">{cat}</span>
          ))}
        </div>
        <CsocDataTable
          columns={["Volunteer", "Type", "Community", "Status", "Distance"]}
          rows={volunteers.map((v, i) => [
            v.name,
            v.type,
            v.community,
            <StatusBadge key={`s-${i}`} tone={v.status === "Available" || v.status === "Verified" ? "success" : "neutral"}>{v.status}</StatusBadge>,
            v.distance,
          ])}
          emptyMessage="No volunteers registered in assigned communities."
        />
      </Panel>
    </>
  );
}
