import { CsocDataTable } from "../../../components/csoc/csoc-data-table";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchDynamicAreaPosts } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function DynamicAreasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filters = {
    country: first(params.country),
    state: first(params.state),
    lga: first(params.lga),
    dynamicAreaKey: first(params.dynamicAreaKey),
    type: first(params.type),
    status: first(params.status),
  };
  const posts = await fetchDynamicAreaPosts(filters);

  return (
    <>
      <PageHeader
        eyebrow="Neighborhood Watch"
        title="Dynamic Public Areas"
        action={
          <StatusBadge tone="info">{posts.length} area conversations in scope</StatusBadge>
        }
      />
      <Panel title="Filter guidance">
        <p className="text-sm text-muted">
          Dynamic Public Area posts are moderated by jurisdiction without requiring a formal Community record.
          Query params: <code>country</code>, <code>state</code>, <code>lga</code>,{" "}
          <code>dynamicAreaKey</code>, <code>type</code>, <code>status=visible|hidden</code>.
        </p>
      </Panel>
      <Panel title="Dynamic area discussions">
        <CsocDataTable
          columns={["Title", "Type", "Area", "Country / State / LGA", "Status", "Created"]}
          rows={posts.map((post) => [
            post.title,
            post.type,
            post.areaLabel,
            [post.country, post.state, post.lga].filter(Boolean).join(" / ") || "—",
            post.hidden ? "Hidden" : "Visible",
            post.createdAt ? new Date(post.createdAt).toLocaleString() : "—",
          ])}
          emptyMessage="No Dynamic Public Area conversations in the current admin scope."
        />
      </Panel>
    </>
  );
}
