import { redirect } from "next/navigation";

export default async function LegacySmartwatchDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/devices/smart-watches/${id}`);
}
