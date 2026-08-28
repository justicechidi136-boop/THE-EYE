import Link from "next/link";
import { BroadcastActions } from "../broadcast-actions";
import { ConsoleEmptyState } from "../console";
import { StatusBadge } from "../ui";
import { humanPriority } from "../../lib/admin-presentation";
import {
  broadcastTypeLabel,
  deliverySummary,
  formatBroadcastDate,
  splitBroadcastMedia,
} from "../../lib/broadcast-detail-presentation";
import type { BroadcastDetailView, BroadcastReportView } from "../../lib/types/admin-views";
import type { AdminEvidenceItem } from "../../lib/admin-media";
import { BroadcastModerationActions } from "./broadcast-moderation-actions";
import { BroadcastDetailMap } from "./broadcast-detail-map";
import { BroadcastEvidenceGallery } from "./broadcast-evidence-gallery";

function DetailList({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 rounded-md border border-line bg-surfaceMuted p-3">
          <dt className="text-xs font-medium text-muted">{item.label}</dt>
          <dd className="mt-1 break-words font-semibold text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function galleryItems(items: BroadcastDetailView["attachments"]): AdminEvidenceItem[] {
  return items.map((item) => ({
    id: item.id,
    type: item.mediaType === "image" ? "Image" : item.mediaType === "video" ? "Video" : item.mediaType === "audio" ? "Audio" : "Media",
    label: item.label,
    contentType: item.contentType,
    url: item.url,
  }));
}

export function BroadcastDetailWorkspace({ broadcast, reports }: { broadcast: BroadcastDetailView; reports: BroadcastReportView[] }) {
  const media = splitBroadcastMedia(broadcast);
  const isSightingType = broadcast.type === "MissingPerson" || broadcast.type === "StolenVehicle";

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <main className="min-w-0 space-y-5">
        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-eye">Broadcast information</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">{broadcast.title}</h2>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-ink">{broadcast.body}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="info">{broadcastTypeLabel(broadcast.type)}</StatusBadge>
              <StatusBadge tone={humanPriority(broadcast.severity) === "HIGH" ? "danger" : humanPriority(broadcast.severity) === "MID" ? "warning" : "neutral"}>{humanPriority(broadcast.severity)}</StatusBadge>
              <StatusBadge tone="neutral">{broadcast.status}</StatusBadge>
            </div>
          </div>
          <div className="mt-5">
            <DetailList items={[
              { label: "Author", value: `${broadcast.author} · ${broadcast.authorLabel}` },
              { label: "Target audience", value: broadcast.target },
              { label: "Location", value: broadcast.location },
              { label: "Captured", value: formatBroadcastDate(broadcast.createdAt) },
              { label: "Published", value: formatBroadcastDate(broadcast.publishedAt) },
              { label: "Delivery", value: deliverySummary(broadcast) },
            ]} />
          </div>
          {broadcast.details.length ? (
            <div className="mt-5 border-t border-line pt-5">
              <h3 className="mb-3 text-sm font-semibold text-ink">Case identity and description</h3>
              <DetailList items={broadcast.details} />
            </div>
          ) : null}
          {broadcast.suspendedReason ? <p className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">Suspended: {broadcast.suspendedReason}</p> : null}
        </section>

        <BroadcastDetailMap latitude={broadcast.targetLatitude} longitude={broadcast.targetLongitude} location={broadcast.location} radiusMeters={broadcast.targetRadiusMeters} />

        {media.identity.length ? (
          <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
            <BroadcastEvidenceGallery broadcastId={broadcast.id} title={broadcast.type === "MissingPerson" ? "Person identity photos" : "Vehicle identity photos"} items={galleryItems(media.identity)} />
          </section>
        ) : null}

        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <BroadcastEvidenceGallery broadcastId={broadcast.id} title="Additional evidence" items={galleryItems(media.evidence)} />
        </section>

        {isSightingType ? (
          <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="font-semibold text-ink">Sightings reported</h2><p className="mt-1 text-sm text-muted">Authorized reports linked to this broadcast.</p></div>
              <StatusBadge tone={broadcast.sightingsCount ? "info" : "neutral"}>{broadcast.sightingsCount}</StatusBadge>
            </div>
            {!broadcast.sightings?.length ? <div className="mt-4"><ConsoleEmptyState title="No sightings yet" detail="New authorized sightings will appear here." /></div> : (
              <div className="mt-4 grid gap-3">
                {broadcast.sightings.map((sighting) => (
                  <article id={`sighting-${sighting.id}`} key={sighting.id} className="rounded-lg border border-line bg-surfaceMuted p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0"><p className="font-semibold text-ink">{sighting.approximateArea ?? "Area not provided"}</p><p className="mt-1 text-xs text-muted">Reported by {sighting.reporter} · {formatBroadcastDate(sighting.observedAt)}</p></div>
                      {sighting.confidence ? <StatusBadge tone="neutral">{sighting.confidence}</StatusBadge> : null}
                    </div>
                    <p className="mt-3 break-words text-sm text-ink">{sighting.description}</p>
                    <details className="mt-3 rounded-md border border-line bg-surface">
                      <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-eye focus:outline-none focus:ring-2 focus:ring-inset focus:ring-eye">View sighting</summary>
                      <div className="grid gap-3 border-t border-line p-3 text-sm">
                        <DetailList items={[
                          { label: "Location source", value: sighting.locationMode.replace(/_/g, " ") },
                          { label: "Direction of travel", value: sighting.directionOfTravel ?? "Not provided" },
                          { label: "Coordinates", value: sighting.latitude != null && sighting.longitude != null ? `${sighting.latitude.toFixed(5)}, ${sighting.longitude.toFixed(5)}` : "Not provided" },
                          { label: "Evidence", value: `${sighting.attachmentsCount} attachment${sighting.attachmentsCount === 1 ? "" : "s"}` },
                        ]} />
                        {sighting.attachments.length ? <BroadcastEvidenceGallery broadcastId={broadcast.id} title="Sighting evidence" items={galleryItems(sighting.attachments)} /> : null}
                      </div>
                    </details>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}

        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-ink">Broadcast reports</h2><StatusBadge tone={reports.length ? "warning" : "neutral"}>{reports.length}</StatusBadge></div>
          {!reports.length ? <div className="mt-4"><ConsoleEmptyState title="No reports" detail="No citizens have reported this broadcast." /></div> : (
            <div className="mt-4 grid gap-3">{reports.map((report) => <article key={report.id} className="rounded-md border border-line bg-surfaceMuted p-4 text-sm"><div className="flex justify-between gap-3"><strong className="text-ink">{report.reason}</strong><StatusBadge tone={report.status === "Open" ? "warning" : "success"}>{report.status}</StatusBadge></div>{report.details ? <p className="mt-2 break-words text-muted">{report.details}</p> : null}<p className="mt-2 text-xs text-muted">{formatBroadcastDate(report.createdAt)}</p></article>)}</div>
          )}
        </section>
      </main>

      <aside className="grid min-w-0 content-start gap-5">
        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Admin actions</h2>
          <p className="mt-1 text-sm text-muted">Actions remain permission and status controlled.</p>
          <div className="mt-4"><BroadcastModerationActions broadcastId={broadcast.id} status={broadcast.status} adminVerified={broadcast.adminVerified} authorLabel={broadcast.authorLabel} showCommentForm /></div>
          <div className="mt-4 border-t border-line pt-4"><BroadcastActions broadcastId={broadcast.id} status={broadcast.status} requiresApproval={broadcast.requiresApproval} scheduledAt={broadcast.scheduledAt} dispatchFailureReason={broadcast.dispatchFailureReason} autoDispatchStatus={broadcast.autoDispatchStatus} /></div>
        </section>

        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Approval &amp; delivery</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div><dt className="text-muted">Approval</dt><dd className="font-semibold text-ink">{broadcast.approval.required ? "Required" : "Not required"}</dd></div>
            <div><dt className="text-muted">Approved by</dt><dd className="break-words font-semibold text-ink">{broadcast.approval.approvedBy ?? "Not recorded"}</dd></div>
            <div><dt className="text-muted">Verification</dt><dd className="break-words font-semibold text-ink">{broadcast.approval.verifiedBy ? `${broadcast.approval.verifiedBy} · ${formatBroadcastDate(broadcast.approval.verifiedAt)}` : "Not verified"}</dd></div>
            <div><dt className="text-muted">Recipients</dt><dd className="font-semibold text-ink">{broadcast.recipients.toLocaleString()}</dd></div>
            <div><dt className="text-muted">Delivery status</dt><dd className="break-words font-semibold text-ink">{deliverySummary(broadcast)}</dd></div>
          </dl>
        </section>

        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Activity timeline</h2>
          {broadcast.timeline.length ? <ol className="mt-4 grid gap-4 border-l border-line pl-4">{broadcast.timeline.map((entry) => <li key={`${entry.at}-${entry.label}`} className="relative"><span className="absolute -left-[1.18rem] top-1.5 h-2 w-2 rounded-full bg-eye" /><p className="text-sm font-semibold text-ink">{entry.label}</p><p className="text-xs text-muted">{entry.actor}</p><time className="text-xs text-muted">{formatBroadcastDate(entry.at)}</time></li>)}</ol> : <p className="mt-3 text-sm text-muted">No lifecycle events recorded.</p>}
        </section>

        <details className="rounded-lg border border-line bg-surface shadow-sm">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-inset focus:ring-eye">Broadcast rules &amp; help</summary>
          <div className="grid gap-4 border-t border-line px-5 py-4 text-sm text-muted">
            <div><h3 className="font-semibold text-ink">Approval rules</h3><p className="mt-1">Publishing and moderation remain governed by the broadcast type, status and administrator permissions.</p></div>
            <div><h3 className="font-semibold text-ink">Geofence</h3><p className="mt-1">Recipient eligibility is calculated by the saved geographic target and server-side scope.</p></div>
            <div><h3 className="font-semibold text-ink">Audit</h3><p className="mt-1">Creation, approval, dispatch and moderation actions remain recorded by the operational audit trail.</p></div>
          </div>
        </details>

        <Link href="/broadcasts" className="inline-flex justify-center rounded-md border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink hover:border-eye">Back to Broadcasts</Link>
      </aside>
    </div>
  );
}
