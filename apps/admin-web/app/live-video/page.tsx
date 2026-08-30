import { AppShell } from "../../components/app-shell";
import { fetchLiveVideoOverview } from "../../lib/api/data";
import { LiveVideoViewer } from "./live-video-viewer";

export const dynamic = "force-dynamic";

export default async function LiveVideoPage() {
  const overview = await fetchLiveVideoOverview();
  return (
    <AppShell>
      <LiveVideoViewer sessions={overview.sessions} activeCount={overview.active} totalCount={overview.total} />
    </AppShell>
  );
}
