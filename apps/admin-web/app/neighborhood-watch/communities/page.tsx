import Link from "next/link";
import { CsocDataTable } from "../../../components/csoc/csoc-data-table";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchCommunities } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function CommunitiesPage() {
  const communities = await fetchCommunities();

  return (
    <>
      <PageHeader
        eyebrow="Community management"
        title="Communities"
        action={<StatusBadge tone="success">{communities.length} communities</StatusBadge>}
      />
      <Panel title="Community registry" aside={<span className="text-xs text-muted">Create, edit boundaries, assign admins via API</span>}>
        <CsocDataTable
          columns={["Community", "Hierarchy", "Members", "Approvals", "Safety Index", ""]}
          rows={communities.map((c) => [
            <div key={`n-${c.id}`}><Link href={`/neighborhood-watch/${c.id}`} className="font-semibold hover:text-eye">{c.name}</Link><p className="text-xs text-muted">{c.level} · {c.visibility}</p></div>,
            c.hierarchy,
            String(c.members),
            <StatusBadge key={`p-${c.id}`} tone={c.pending ? "warning" : "success"}>{c.pending}</StatusBadge>,
            <StatusBadge key={`c-${c.id}`} tone={c.confidence >= 80 ? "success" : "info"}>{c.confidence}%</StatusBadge>,
            <Link key={`l-${c.id}`} href={`/neighborhood-watch/${c.id}`} className="text-sm font-semibold text-eye hover:underline">Manage</Link>,
          ])}
          emptyMessage="No communities in your jurisdiction."
        />
      </Panel>
    </>
  );
}
