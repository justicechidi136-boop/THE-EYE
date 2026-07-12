import Link from "next/link";
import { CsocDataTable } from "../../../components/csoc/csoc-data-table";
import { PostVerifyButton } from "../../../components/csoc/post-verify-button";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchCommunityPosts } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

const QUEUE_TABS = ["Pending", "Verified", "Disputed", "False"] as const;

export default async function VerificationCentrePage() {
  const posts = await fetchCommunityPosts();

  return (
    <>
      <PageHeader
        eyebrow="Verification workspace"
        title="Verification Queue"
        action={<StatusBadge tone="warning">AI + moderator review</StatusBadge>}
      />
      {QUEUE_TABS.map((tab) => {
        const filtered = posts.filter((p) => {
          if (tab === "Pending") return p.status === "Pending Verification" || p.status === "Pending";
          return p.status === tab;
        });
        return (
          <Panel key={tab} title={`${tab} reports (${filtered.length})`}>
            <CsocDataTable
              columns={["Report", "Community", "Confidence", "GPS", "Incident", "Actions"]}
              rows={filtered.map((post) => [
                <div key={`t-${post.id}`}><p className="font-semibold">{post.title}</p><p className="text-xs text-muted">{post.type}</p></div>,
                post.community,
                <StatusBadge key={`c-${post.id}`} tone={post.confidence >= 80 ? "success" : post.confidence >= 60 ? "info" : "warning"}>{post.confidence}%</StatusBadge>,
                post.location,
                post.linkedIncident !== "-" ? <Link key={`i-${post.id}`} href={`/incidents/${post.linkedIncident}`} className="text-eye hover:underline">Linked</Link> : "—",
                <div key={`a-${post.id}`} className="flex flex-wrap gap-2">
                  <PostVerifyButton postId={post.id} status="Verified" />
                  <PostVerifyButton postId={post.id} status="False" />
                </div>,
              ])}
              emptyMessage={`No ${tab.toLowerCase()} reports.`}
            />
          </Panel>
        );
      })}
    </>
  );
}
