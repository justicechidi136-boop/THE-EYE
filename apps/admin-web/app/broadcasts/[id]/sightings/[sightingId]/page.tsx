import Link from "next/link";
import { AppShell } from "../../../../../components/app-shell";
import { BroadcastDetailMap } from "../../../../../components/broadcast/broadcast-detail-map";
import { BroadcastEvidenceGallery } from "../../../../../components/broadcast/broadcast-evidence-gallery";
import { ConsoleEmptyState, ConsolePageHeader } from "../../../../../components/console";
import { StatusBadge } from "../../../../../components/ui";
import { formatBroadcastDate } from "../../../../../lib/broadcast-detail-presentation";
import { fetchAdminBroadcast } from "../../../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function SightingDetailPage({ params }: { params: Promise<{ id: string; sightingId: string }> }) {
  const { id, sightingId } = await params;
  const broadcast = await fetchAdminBroadcast(id);
  const sighting = broadcast?.sightings?.find((item) => item.id === sightingId);

  if (!broadcast || !sighting) {
    return <AppShell><ConsolePageHeader title="Sighting not found" eyebrow="Broadcast operations" breadcrumbs={["Broadcasts", "Sightings", "Review"]} /><ConsoleEmptyState title="Sighting not found" detail="This sighting may be outside your jurisdiction or no longer available." /></AppShell>;
  }

  const evidence = sighting.attachments.map((item) => ({
    id: item.id,
    type: item.mediaType === "image" ? "Image" : item.mediaType === "video" ? "Video" : item.mediaType === "audio" ? "Audio" : "Media",
    label: item.label,
    contentType: item.contentType,
    url: item.url,
  }));

  return (
    <AppShell>
      <ConsolePageHeader title="Review Sighting" eyebrow={broadcast.title} breadcrumbs={["Broadcasts", "Details", "Sightings", "Review"]} action={<StatusBadge tone={sighting.reviewStatus === "Verified" ? "success" : sighting.reviewStatus === "Dismissed" ? "danger" : "warning"}>{sighting.reviewStatus}</StatusBadge>} />
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="min-w-0 space-y-5">
          <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-eye">Sighting report</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{sighting.approximateArea ?? "Area not provided"}</h2>
            <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-ink">{sighting.description}</p>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              {[
                ["Reporter", sighting.reporter], ["Reported", formatBroadcastDate(sighting.reportedAt)],
                ["Observed", formatBroadcastDate(sighting.observedAt)], ["Location source", sighting.locationMode.replace(/_/g, " ")],
                ["Direction of travel", sighting.directionOfTravel ?? "Not provided"], ["Confidence", sighting.confidence ?? "Not recorded"],
              ].map(([label, value]) => <div key={label} className="border-l-2 border-eye bg-surfaceMuted px-3 py-2"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 break-words font-semibold text-ink">{value}</dd></div>)}
            </dl>
          </section>
          <BroadcastDetailMap latitude={sighting.latitude} longitude={sighting.longitude} location={sighting.approximateArea ?? "Sighting location"} radiusMeters={null} markers={broadcast.targetLatitude != null && broadcast.targetLongitude != null ? [{ id: "last-known", latitude: broadcast.targetLatitude, longitude: broadcast.targetLongitude, label: "Broadcast last-known location" }] : []} />
          <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><BroadcastEvidenceGallery broadcastId={broadcast.id} title="Sighting evidence" items={evidence} /></section>
        </main>
        <aside className="grid content-start gap-5">
          <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
            <h2 className="font-semibold text-ink">Review status</h2>
            <p className="mt-2 text-sm text-muted">{sighting.reviewNote ?? "No review note has been recorded."}</p>
            <p className="mt-4 text-xs text-muted">Review decisions remain server-authoritative. This view does not expose hidden reporter data or permanent media URLs.</p>
          </section>
          <Link href={`/broadcasts/${broadcast.id}#sighting-${sighting.id}`} className="inline-flex justify-center rounded-md border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink hover:border-eye">Back to Broadcast</Link>
        </aside>
      </div>
    </AppShell>
  );
}
