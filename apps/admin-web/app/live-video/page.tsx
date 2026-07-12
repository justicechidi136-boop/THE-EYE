import { fetchLiveVideoSessions } from "../../lib/api/data";
import { LiveVideoViewer } from "./live-video-viewer";

export const dynamic = "force-dynamic";

export default async function LiveVideoPage() {
  const sessions = await fetchLiveVideoSessions();
  return <LiveVideoViewer sessions={sessions} />;
}
