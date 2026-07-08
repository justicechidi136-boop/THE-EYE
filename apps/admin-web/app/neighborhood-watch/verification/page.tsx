import { AppShell } from "../../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { communityPosts } from "../../../lib/mock-data";

export default function CommunityVerificationPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Community verification" title="Verification queue" action={<StatusBadge tone="warning">Confidence scoring</StatusBadge>} />
      <Panel title="Signals">
        <div className="grid gap-3">
          {communityPosts.map((post) => <div key={post.id} className="rounded-lg border border-line bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{post.title}</p><p className="text-sm text-muted">Reporter trust, location match, media evidence, confirmations, moderator confirmation, incident match</p></div><StatusBadge tone={post.confidence >= 80 ? "success" : post.confidence >= 60 ? "info" : "warning"}>{post.confidence}%</StatusBadge></div></div>)}
        </div>
      </Panel>
    </AppShell>
  );
}
