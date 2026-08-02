import { CommunityChatConsole } from "../../../components/community/community-chat-console";
import { ConsolePageHeader } from "../../../components/console";
import { StatusBadge } from "../../../components/ui";
import { fetchCommunityChannels, fetchContentReports } from "../../../lib/api/data";
import { getRouteById } from "../../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

export default async function CommunityChatPage() {
  const route = getRouteById("community-chat");
  const [channels, reports] = await Promise.all([fetchCommunityChannels(100), fetchContentReports()]);

  return (
    <>
      <ConsolePageHeader
        title={route?.pageHeading ?? "Community chat moderation"}
        eyebrow="Channel oversight and report queue"
        breadcrumbs={route?.breadcrumb}
        action={<StatusBadge tone="info">{channels.length} channels</StatusBadge>}
      />
      <CommunityChatConsole channels={channels} reports={reports} />
    </>
  );
}
