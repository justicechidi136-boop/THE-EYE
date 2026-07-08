import { AppShell } from "../../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { communityPosts, patrolSchedules, volunteers } from "../../../lib/mock-data";

export default function CommunityMapPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="PostGIS community map" title="Community map" action={<StatusBadge tone="success">Live layers</StatusBadge>} />
      <Panel title="Map layers">
        <div className="leaflet-grid relative min-h-[520px] rounded-lg border border-line">
          <span className="absolute left-[42%] top-[36%] h-4 w-4 rounded-full bg-amber-500 ring-4 ring-amber-500/20" />
          <span className="absolute left-[56%] top-[48%] h-4 w-4 rounded-full bg-red-600 ring-4 ring-red-600/20" />
          <span className="absolute left-[62%] top-[58%] h-4 w-4 rounded-full bg-emerald-600 ring-4 ring-emerald-600/20" />
          <div className="absolute bottom-4 left-4 rounded-lg border border-line bg-white/95 p-3 shadow-soft">
            <p className="font-semibold">Community safety layers</p>
            <p className="text-sm text-muted">{communityPosts.length} posts, {volunteers.length} volunteers, {patrolSchedules.length} patrol routes, police stations, hospitals, safe points, danger zones.</p>
          </div>
        </div>
      </Panel>
    </AppShell>
  );
}
