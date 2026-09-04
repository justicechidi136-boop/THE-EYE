import Link from "next/link";
import { BroadcastActions } from "../broadcast-actions";
import { ConsoleEmptyState } from "../console";
import { StatusBadge } from "../ui";
import { deliverySummary, formatBroadcastDate, splitBroadcastMedia } from "../../lib/broadcast-detail-presentation";
import type { BroadcastDetailView, BroadcastReportView } from "../../lib/types/admin-views";
import type { AdminEvidenceItem } from "../../lib/admin-media";
import { BroadcastModerationActions } from "./broadcast-moderation-actions";
import { BroadcastDetailMap } from "./broadcast-detail-map";
import { BroadcastEvidenceGallery } from "./broadcast-evidence-gallery";
import { BroadcastSightingsSection } from "./broadcast-sightings-section";

function DetailList({ items }: { items: Array<{ label: string; value: string }> }) {
  return <dl className="grid gap-3 text-sm sm:grid-cols-2">{items.map((item) => (
    <div key={item.label} className="min-w-0 border-l-2 border-eye bg-surfaceMuted px-3 py-2">
      <dt className="text-xs font-medium text-muted">{item.label}</dt>
      <dd className="mt-1 break-words font-semibold text-ink">{item.value}</dd>
    </div>
  ))}</dl>;
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

function EvidenceSections({ broadcastId, items, title = "Broadcast evidence", description, hideWhenEmpty = false }: { broadcastId: string; items: BroadcastDetailView["attachments"]; title?: string; description?: string; hideWhenEmpty?: boolean }) {
  if (hideWhenEmpty && !items.length) return null;
  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-eye">Private signed access</p>
      <h2 className="mt-1 font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      <div className="mt-4 grid gap-5">
        {[{ title: "Photos", type: "image" }, { title: "Videos", type: "video" }, { title: "Audio", type: "audio" }].map((group) => (
          <BroadcastEvidenceGallery key={group.type} broadcastId={broadcastId} title={group.title} items={galleryItems(items.filter((item) => item.mediaType.toLowerCase() === group.type))} />
        ))}
      </div>
    </section>
  );
}

function BroadcastInformation({ broadcast }: { broadcast: BroadcastDetailView }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
      <h2 className="font-semibold text-ink">Broadcast information</h2>
      <p className="mt-4 whitespace-pre-wrap break-words rounded-md border border-line bg-surfaceMuted p-4 text-sm leading-6 text-ink">{broadcast.body}</p>
      <div className="mt-4"><DetailList items={[
        { label: broadcast.authorLabel === "Admin" ? "Created by" : "Author", value: `${broadcast.author} · ${broadcast.authorLabel}` },
        { label: "Target audience", value: broadcast.target },
        { label: broadcast.authorLabel === "Admin" ? "Created" : "Submitted", value: formatBroadcastDate(broadcast.createdAt) },
        { label: "Published", value: formatBroadcastDate(broadcast.publishedAt) },
      ]} /></div>
    </section>
  );
}

function mapProps(broadcast: BroadcastDetailView) {
  return { latitude: broadcast.targetLatitude, longitude: broadcast.targetLongitude, location: broadcast.location, radiusMeters: broadcast.targetRadiusMeters };
}

function MissingPersonDetails({ broadcast }: { broadcast: BroadcastDetailView }) {
  const person = broadcast.missingPerson!;
  const media = splitBroadcastMedia(broadcast);
  return <>
    <BroadcastInformation broadcast={broadcast} />
    <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
      <h2 className="font-semibold text-ink">Photo</h2>
      <p className="mt-1 text-sm text-muted">Primary photo of the missing person — kept separate from Evidence below.</p>
      <div className="mt-4 max-w-sm"><BroadcastEvidenceGallery broadcastId={broadcast.id} title="Primary photo" items={galleryItems(media.primary)} /></div>
    </section>
    <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
      <h2 className="font-semibold text-ink">Missing person information</h2>
      <div className="mt-4"><DetailList items={[
        { label: "Full name", value: person.fullName }, { label: "Age", value: person.age }, { label: "Gender", value: person.gender },
      ]} /></div>
      <div className="mt-5 border-t border-line pt-5"><h3 className="mb-3 font-semibold text-ink">Description</h3><DetailList items={[
        { label: "Physical description", value: person.physicalDescription },
        { label: "Clothing / what they were wearing", value: person.clothingDescription },
        { label: "Additional information", value: person.additionalInformation },
      ]} /></div>
      {broadcast.suspendedReason ? <p className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">Suspended: {broadcast.suspendedReason}</p> : null}
    </section>
    <BroadcastDetailMap
      title="Last seen"
      description={formatBroadcastDate(person.lastSeenAt)}
      latitude={broadcast.targetLatitude}
      longitude={broadcast.targetLongitude}
      location={person.lastSeenLocation}
      radiusMeters={null}
    />
    <EvidenceSections broadcastId={broadcast.id} items={media.evidence} title="Evidence" description="Submitted separately from the person&apos;s primary photo above." />
    <BroadcastDetailMap
      title="Target location"
      description={`Scope: ${broadcast.target}`}
      {...mapProps(broadcast)}
      showOpenLocation={false}
    />
  </>;
}

function StolenVehicleDetails({ broadcast }: { broadcast: BroadcastDetailView }) {
  const vehicle = broadcast.stolenVehicle!;
  const media = splitBroadcastMedia(broadcast);
  return <>
    <BroadcastInformation broadcast={broadcast} />
    <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
      <h2 className="font-semibold text-ink">Vehicle information</h2>
      <div className="mt-4"><DetailList items={[
        { label: "Make", value: vehicle.make }, { label: "Model", value: vehicle.model }, { label: "Year", value: vehicle.year },
        { label: "Color", value: vehicle.colour }, { label: "Plate number", value: vehicle.plateNumber }, { label: "VIN / Chassis", value: vehicle.vin },
      ]} /></div>
    </section>
    <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
      <h2 className="font-semibold text-ink">Vehicle photos</h2>
      <p className="mt-1 text-sm text-muted">Reference photos by angle — kept separate from Incident evidence below.</p>
      <div className="mt-4"><BroadcastEvidenceGallery broadcastId={broadcast.id} title="Front, rear, side and other views" items={galleryItems(media.identity)} /></div>
    </section>
    <BroadcastDetailMap title="Last seen" description={formatBroadcastDate(vehicle.lastSeenAt ?? vehicle.stolenAt)} latitude={broadcast.targetLatitude} longitude={broadcast.targetLongitude} location={vehicle.lastKnownLocation} radiusMeters={null} />
    <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
      <h2 className="font-semibold text-ink">Description of theft</h2><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-ink">{vehicle.theftAccount}</p>
      <h2 className="mt-5 border-t border-line pt-5 font-semibold text-ink">Distinguishing features</h2><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-ink">{vehicle.distinguishingFeatures}</p>
    </section>
    <EvidenceSections broadcastId={broadcast.id} items={media.evidence} title="Incident evidence" description="Submitted separately from the vehicle photos above." />
    <BroadcastDetailMap title="Target location" description={`Scope: ${broadcast.target}`} {...mapProps(broadcast)} showOpenLocation={false} />
  </>;
}

function AdminBroadcastDetails({ broadcast }: { broadcast: BroadcastDetailView }) {
  const media = splitBroadcastMedia(broadcast);
  return <>
    <BroadcastInformation broadcast={broadcast} />
    <EvidenceSections broadcastId={broadcast.id} items={media.evidence} title="Attachments" description="Only shown when the admin attached supporting material." hideWhenEmpty />
    <BroadcastDetailMap title="Target location" description={`Scope: ${broadcast.target}`} {...mapProps(broadcast)} showOpenLocation={false} />
  </>;
}

export function BroadcastDetailWorkspace({ broadcast, reports }: { broadcast: BroadcastDetailView; reports: BroadcastReportView[] }) {
  return <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <main className="min-w-0 space-y-5">
      {broadcast.type === "MissingPerson" && broadcast.missingPerson ? <MissingPersonDetails broadcast={broadcast} /> : null}
      {broadcast.type === "StolenVehicle" && broadcast.stolenVehicle ? <StolenVehicleDetails broadcast={broadcast} /> : null}
      {broadcast.type !== "MissingPerson" && broadcast.type !== "StolenVehicle" ? <AdminBroadcastDetails broadcast={broadcast} /> : null}
      <BroadcastSightingsSection broadcast={broadcast} />
      {broadcast.authorLabel === "Admin" ? <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-ink">Broadcast reports</h2><StatusBadge tone={reports.length ? "warning" : "neutral"}>{reports.length}</StatusBadge></div>{!reports.length ? <div className="mt-4"><ConsoleEmptyState title="No reports" detail="No citizens have reported this broadcast." /></div> : <div className="mt-4 grid gap-3">{reports.map((report) => <article key={report.id} className="rounded-md border border-line bg-surfaceMuted p-4 text-sm"><div className="flex justify-between gap-3"><strong className="text-ink">{report.reason}</strong><StatusBadge tone={report.status === "Open" ? "warning" : "success"}>{report.status}</StatusBadge></div>{report.details ? <p className="mt-2 break-words text-muted">{report.details}</p> : null}<p className="mt-2 text-xs text-muted">{formatBroadcastDate(report.createdAt)}</p></article>)}</div>}</section> : null}
    </main>
    <aside className="grid min-w-0 content-start gap-5">
      <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-semibold text-ink">Admin actions</h2><p className="mt-1 text-sm text-muted">Actions remain permission and status controlled.</p><div className="mt-4"><BroadcastModerationActions broadcastId={broadcast.id} status={broadcast.status} adminVerified={broadcast.adminVerified} authorLabel={broadcast.authorLabel} showCommentForm secondaryActions={broadcast.authorLabel === "Admin" ? null : <BroadcastActions broadcastId={broadcast.id} status={broadcast.status} requiresApproval={broadcast.requiresApproval} scheduledAt={broadcast.scheduledAt} dispatchFailureReason={broadcast.dispatchFailureReason} autoDispatchStatus={broadcast.autoDispatchStatus} detailMode="citizen" />} /></div></section>
      <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-semibold text-ink">Approval &amp; delivery</h2><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-muted">Approval</dt><dd className="font-semibold text-ink">{broadcast.approval.required ? "Required" : "Auto-approved"}</dd></div><div><dt className="text-muted">Approved by</dt><dd className="break-words font-semibold text-ink">{broadcast.approval.approvedBy ?? (broadcast.approval.required ? "Not recorded" : "System")}</dd></div><div><dt className="text-muted">Verification</dt><dd className="break-words font-semibold text-ink">{broadcast.approval.verifiedBy ? `${broadcast.approval.verifiedBy} · ${formatBroadcastDate(broadcast.approval.verifiedAt)}` : "Not verified"}</dd></div><div><dt className="text-muted">Recipients</dt><dd className="font-semibold text-ink">{broadcast.recipients.toLocaleString()}</dd></div><div><dt className="text-muted">Delivery status</dt><dd className="break-words font-semibold text-ink">{deliverySummary(broadcast)}</dd></div></dl></section>
      <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-semibold text-ink">Activity timeline</h2>{broadcast.timeline.length ? <ol className="mt-4 grid gap-4 border-l border-line pl-4">{broadcast.timeline.map((entry) => <li key={`${entry.at}-${entry.label}`} className="relative"><span className="absolute -left-[1.18rem] top-1.5 h-2 w-2 rounded-full bg-eye" /><p className="text-sm font-semibold text-ink">{entry.label}</p><p className="text-xs text-muted">{entry.actor}</p><time className="text-xs text-muted">{formatBroadcastDate(entry.at)}</time></li>)}</ol> : <p className="mt-3 text-sm text-muted">No lifecycle events recorded.</p>}</section>
      <details className="rounded-lg border border-line bg-surface shadow-sm">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-inset focus:ring-eye">Broadcast rules &amp; help</summary>
        <div className="grid gap-4 border-t border-line p-5 text-sm text-muted">
          <p>Citizen identity, case evidence, and sighting evidence remain separate. Access follows the current Admin role and geographic scope.</p>
          <p>Media stays private and is opened only through short-lived authorized signed access.</p>
          <p>Approval, moderation, dispatch, review, suspension, resolution, and withdrawal activity remains auditable.</p>
        </div>
      </details>
      <Link href="/broadcasts" className="inline-flex justify-center rounded-md border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink hover:border-eye">Back to Broadcasts</Link>
    </aside>
  </div>;
}
