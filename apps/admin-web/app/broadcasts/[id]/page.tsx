import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { BroadcastActions } from "../../../components/broadcast-actions";
import { authorLabelTone, BroadcastModerationActions } from "../../../components/broadcast/broadcast-moderation-actions";
import { EvidenceGallery } from "../../../components/admin-media";
import { ConsoleEmptyState, ConsolePageHeader } from "../../../components/console";
import { StatusBadge } from "../../../components/ui";
import { fetchAdminBroadcast, fetchBroadcastReports } from "../../../lib/api/data";
import { getRouteById } from "../../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

export default async function BroadcastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const route = getRouteById("broadcasts");
  const [broadcast, reports] = await Promise.all([fetchAdminBroadcast(id), fetchBroadcastReports(id)]);

  if (!broadcast) {
    return (
      <AppShell>
        <ConsolePageHeader
          title="Broadcast not found"
          eyebrow="Broadcast moderation"
          breadcrumbs={[...(route?.breadcrumb ?? []), "Detail"]}
          action={<StatusBadge tone="warning">Missing</StatusBadge>}
        />
        <ConsoleEmptyState title="Broadcast not found" detail="The broadcast may be outside your jurisdiction or deleted." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ConsolePageHeader
        title={broadcast.title}
        eyebrow={broadcast.id}
        breadcrumbs={[...(route?.breadcrumb ?? []), "Detail"]}
        action={
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={authorLabelTone(broadcast.authorLabel)}>{broadcast.authorLabel}</StatusBadge>
            <StatusBadge tone="info">{broadcast.status}</StatusBadge>
          </div>
        }
      />

      <div className="grid min-w-0 gap-5 xl:grid-cols-3">
        <section className="min-w-0 space-y-5 xl:col-span-2">
          <article className="rounded-lg border border-line bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold text-ink">Message</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{broadcast.body}</p>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Type</dt><dd className="font-medium">{broadcast.type}</dd></div>
              <div><dt className="text-muted">Priority</dt><dd className="font-medium">{broadcast.severity}</dd></div>
              <div><dt className="text-muted">Target</dt><dd className="font-medium">{broadcast.target}</dd></div>
              <div><dt className="text-muted">Author</dt><dd className="font-medium">{broadcast.author}</dd></div>
              <div><dt className="text-muted">Country</dt><dd className="font-medium">{broadcast.country ?? "—"}</dd></div>
              <div><dt className="text-muted">State</dt><dd className="font-medium">{broadcast.state ?? "—"}</dd></div>
              <div><dt className="text-muted">Published</dt><dd className="font-medium">{broadcast.publishedAt ? new Date(broadcast.publishedAt).toLocaleString() : "—"}</dd></div>
              <div><dt className="text-muted">Created</dt><dd className="font-medium">{broadcast.createdAt ? new Date(broadcast.createdAt).toLocaleString() : "—"}</dd></div>
            </dl>
            {broadcast.suspendedReason ? (
              <p className="mt-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                Suspended: {broadcast.suspendedReason}
              </p>
            ) : null}
          </article>

          <article className="rounded-lg border border-line bg-surface p-5 shadow-sm">
            <EvidenceGallery
              title="Broadcast media"
              items={broadcast.attachments.map((item) => ({
                type: item.mediaType === "image" ? "Image" : item.mediaType === "video" ? "Video" : item.mediaType === "audio" ? "Audio" : "Media",
                label: item.label,
                contentType: item.contentType,
                url: item.url,
              }))}
            />
          </article>

          <article className="rounded-lg border border-line bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-ink">Citizen reports</h2>
              <StatusBadge tone={reports.length ? "warning" : "neutral"}>{reports.length}</StatusBadge>
            </div>
            {!reports.length ? (
              <div className="mt-4">
                <ConsoleEmptyState title="No reports" detail="No citizen reports have been filed for this broadcast." />
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                {reports.map((report) => (
                  <div key={report.id} className="rounded-lg border border-line bg-surfaceMuted p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong>{report.reason}</strong>
                      <StatusBadge tone={report.status === "Open" ? "warning" : "success"}>{report.status}</StatusBadge>
                    </div>
                    {report.details ? <p className="mt-2 text-muted">{report.details}</p> : null}
                    <p className="mt-2 text-xs text-muted">
                      {report.createdAt ? new Date(report.createdAt).toLocaleString() : "Unknown time"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-lg border border-line bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-ink">Sightings</h2>
              <StatusBadge tone={broadcast.sightingsCount ? "info" : "neutral"}>{broadcast.sightingsCount}</StatusBadge>
            </div>
            {!broadcast.sightings?.length ? (
              <div className="mt-4">
                <ConsoleEmptyState title="No sightings yet" detail="Citizen sightings will appear here for authorized administrators." />
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                {broadcast.sightings.map((sighting) => (
                  <div key={sighting.id} className="rounded-lg border border-line bg-surfaceMuted p-4 text-sm">
                    <p className="font-semibold text-ink">{sighting.approximateArea ?? "Area not provided"}</p>
                    <p className="mt-1 text-muted">{sighting.description}</p>
                    <p className="mt-2 text-xs text-muted">
                      {sighting.observedAt ? new Date(sighting.observedAt).toLocaleString() : "Observed time not provided"} · {sighting.locationMode} · {sighting.attachmentsCount} attachment{sighting.attachmentsCount === 1 ? "" : "s"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>

        <aside className="grid gap-5">
          <article className="rounded-lg border border-line bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold text-ink">Moderation</h2>
            <div className="mt-4">
              <BroadcastModerationActions
                broadcastId={broadcast.id}
                status={broadcast.status}
                adminVerified={broadcast.adminVerified}
                authorLabel={broadcast.authorLabel}
                showCommentForm
              />
            </div>
          </article>

          <article className="rounded-lg border border-line bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold text-ink">Dispatch controls</h2>
            <div className="mt-4">
              <BroadcastActions
                broadcastId={broadcast.id}
                status={broadcast.status}
                requiresApproval={broadcast.requiresApproval}
                scheduledAt={broadcast.scheduledAt}
                dispatchFailureReason={broadcast.dispatchFailureReason}
                autoDispatchStatus={broadcast.autoDispatchStatus}
              />
            </div>
          </article>

          <article className="rounded-lg border border-line bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold text-ink">Engagement</h2>
            <dl className="mt-4 grid gap-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">Recipients</dt><dd>{broadcast.recipients}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Comments</dt><dd>{broadcast.commentCount}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Reports</dt><dd>{broadcast.reportCount}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Sightings</dt><dd>{broadcast.sightingsCount}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Delivery</dt><dd>{broadcast.delivery}</dd></div>
            </dl>
            <Link href="/broadcasts" className="mt-4 inline-flex rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-accent">
              Back to broadcasts
            </Link>
          </article>
        </aside>
      </div>
    </AppShell>
  );
}
