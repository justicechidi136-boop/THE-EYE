import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyCommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/neighborhood-watch/communities/${id}`);
}
