import { CsocDataTable } from "../../../components/csoc/csoc-data-table";
import { MembershipActionButton } from "../../../components/csoc/membership-action-button";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchPendingMemberships } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const pending = await fetchPendingMemberships();

  return (
    <>
      <PageHeader
        eyebrow="Membership approvals"
        title="Resident Approvals"
        action={<StatusBadge tone="warning">{pending.length} pending</StatusBadge>}
      />
      <Panel title="Pending applications">
        <CsocDataTable
          columns={["Applicant", "Community", "Role", "Trust", "Actions"]}
          rows={pending.map((r) => [
            <div key={`n-${r.membershipId}`}><p className="font-semibold">{r.name}</p><p className="text-xs text-muted">{r.email}</p></div>,
            r.community,
            r.role,
            `${r.trustScore}%`,
            <div key={`a-${r.membershipId}`} className="flex gap-2">
              <MembershipActionButton communityId={r.communityId} membershipId={r.membershipId} action="approve" />
            </div>,
          ])}
          emptyMessage="No pending resident applications."
        />
      </Panel>
    </>
  );
}
