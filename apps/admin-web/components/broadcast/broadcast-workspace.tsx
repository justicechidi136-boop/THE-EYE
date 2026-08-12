"use client";

import Link from "next/link";
import type { BroadcastView } from "../../lib/types/admin-views";
import { BroadcastActions } from "../broadcast-actions";
import { BroadcastCreateForm } from "../broadcast-create-form";
import { ConsoleEmptyState } from "../console";
import { StatusBadge } from "../ui";
import { BroadcastFilters } from "./broadcast-filters";
import { authorLabelTone, BroadcastModerationActions } from "./broadcast-moderation-actions";

type BroadcastWorkspaceProps = {
  broadcasts: BroadcastView[];
  pending: number;
  published: number;
  scheduled: number;
  queueWaiting: number;
  workerActive: boolean;
  schedulerActive: boolean;
  dueCount?: number;
  filterDefaults?: {
    country?: string;
    state?: string;
    status?: string;
    category?: string;
    author?: string;
  };
};

function deliveryTone(delivery: string): "success" | "info" | "warning" | "neutral" {
  if (delivery === "Sent") return "success";
  if (delivery === "Failed") return "warning";
  return "info";
}

export function BroadcastWorkspace({
  broadcasts,
  pending,
  published,
  scheduled,
  queueWaiting,
  workerActive,
  schedulerActive,
  dueCount,
  filterDefaults,
}: BroadcastWorkspaceProps) {
  return (
    <div className="grid min-w-0 gap-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="min-w-0 rounded-lg border border-line bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">Pending approval</p>
          <strong className="mt-2 block text-2xl text-warning">{pending}</strong>
        </article>
        <article className="min-w-0 rounded-lg border border-line bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">Published</p>
          <strong className="mt-2 block text-2xl text-success">{published}</strong>
        </article>
        <article className="min-w-0 rounded-lg border border-line bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">Scheduled</p>
          <strong className="mt-2 block text-2xl text-ink">{scheduled}</strong>
        </article>
        <article className="min-w-0 rounded-lg border border-line bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">Queue waiting</p>
          <strong className="mt-2 block text-2xl text-ink">{queueWaiting}</strong>
          <span className="mt-2 block text-xs text-muted">
            Worker {workerActive ? "active" : "stale"} · Scheduler {schedulerActive ? "active" : "stale"}
            {dueCount ? ` · ${dueCount} due now` : ""}
          </span>
        </article>
      </section>

      <section className="rounded-lg border border-line bg-surface shadow-sm">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-ink">Create broadcast</h2>
          <p className="mt-1 text-sm text-muted">Geographic targeting uses lat/lng radius or PostGIS WKT via API.</p>
        </div>
        <div className="min-w-0 p-4">
          <BroadcastCreateForm />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface shadow-sm">
        <div className="sticky top-0 z-10 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink">Broadcast list</h2>
              <p className="mt-1 text-sm text-muted">{broadcasts.length} broadcasts in scope</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href="/broadcasts/reports" className="rounded-md border border-line px-3 py-2 font-semibold text-ink hover:border-accent">
                Reports
              </Link>
              <Link href="/broadcasts/analytics" className="rounded-md border border-line px-3 py-2 font-semibold text-ink hover:border-accent">
                Analytics
              </Link>
            </div>
          </div>
          <div className="mt-4">
            <BroadcastFilters
              defaultCountry={filterDefaults?.country}
              defaultState={filterDefaults?.state}
              defaultStatus={filterDefaults?.status}
              defaultCategory={filterDefaults?.category}
              defaultAuthor={filterDefaults?.author}
            />
          </div>
        </div>

        {!broadcasts.length ? (
          <div className="p-4">
            <ConsoleEmptyState title="No broadcasts returned" detail="Create a broadcast or adjust admin jurisdiction scope." />
          </div>
        ) : (
          <>
            <div className="hidden min-w-0 xl:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-0 table-fixed text-left text-sm">
                  <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                    <tr>
                      <th className="w-[20%] px-4 py-3">Broadcast</th>
                      <th className="w-[8%] px-4 py-3">Author</th>
                      <th className="w-[10%] px-4 py-3">Type</th>
                      <th className="w-[8%] px-4 py-3">Priority</th>
                      <th className="w-[12%] px-4 py-3">Target</th>
                      <th className="w-[10%] px-4 py-3">Approval</th>
                      <th className="w-[12%] px-4 py-3">Schedule</th>
                      <th className="w-[8%] px-4 py-3">Delivery</th>
                      <th className="w-[12%] px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {broadcasts.map((broadcast) => (
                      <tr key={broadcast.id} className="align-top">
                        <td className="px-4 py-3">
                          <Link href={`/broadcasts/${broadcast.id}`} className="break-words font-semibold text-accent hover:underline">
                            {broadcast.title}
                          </Link>
                          <p className="mt-1 break-all text-xs text-muted">{broadcast.id}</p>
                          <p className="mt-1 break-words text-xs text-muted">{broadcast.author}</p>
                          {broadcast.reportCount > 0 ? (
                            <p className="mt-1 text-xs text-warning">{broadcast.reportCount} report{broadcast.reportCount === 1 ? "" : "s"}</p>
                          ) : null}
                          {broadcast.sightingsCount > 0 ? (
                            <p className="mt-1 text-xs text-accent">{broadcast.sightingsCount} sighting{broadcast.sightingsCount === 1 ? "" : "s"}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={authorLabelTone(broadcast.authorLabel)}>{broadcast.authorLabel}</StatusBadge>
                        </td>
                        <td className="break-words px-4 py-3">{broadcast.type}</td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={broadcast.severity === "P1" ? "danger" : "warning"}>{broadcast.severity}</StatusBadge>
                        </td>
                        <td className="break-words px-4 py-3 text-muted">{broadcast.target}</td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={broadcast.requiresApproval ? "warning" : "success"}>
                            {broadcast.requiresApproval ? broadcast.status : "Auto"}
                          </StatusBadge>
                        </td>
                        <td className="break-words px-4 py-3 text-muted">
                          <p>{broadcast.schedulingState}</p>
                          <p className="mt-1 text-xs">{broadcast.scheduledAt ? new Date(broadcast.scheduledAt).toLocaleString() : "Not scheduled"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={deliveryTone(broadcast.delivery)}>{broadcast.delivery}</StatusBadge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="sticky top-16 grid gap-3">
                            <BroadcastModerationActions
                              broadcastId={broadcast.id}
                              status={broadcast.status}
                              adminVerified={broadcast.adminVerified}
                              authorLabel={broadcast.authorLabel}
                            />
                            <BroadcastActions
                              broadcastId={broadcast.id}
                              status={broadcast.status}
                              requiresApproval={broadcast.requiresApproval}
                              scheduledAt={broadcast.scheduledAt}
                              dispatchFailureReason={broadcast.dispatchFailureReason}
                              autoDispatchStatus={broadcast.autoDispatchStatus}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-3 p-4 xl:hidden">
              {broadcasts.map((broadcast) => (
                <article key={broadcast.id} className="min-w-0 rounded-lg border border-line bg-surfaceMuted p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link href={`/broadcasts/${broadcast.id}`} className="break-words font-semibold text-accent hover:underline">
                        {broadcast.title}
                      </Link>
                      <p className="mt-1 break-all text-xs text-muted">{broadcast.id}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge tone={authorLabelTone(broadcast.authorLabel)}>{broadcast.authorLabel}</StatusBadge>
                      <StatusBadge tone={broadcast.severity === "P1" ? "danger" : "warning"}>{broadcast.severity}</StatusBadge>
                    </div>
                  </div>
                  <dl className="mt-3 grid gap-2 text-sm">
                    <div className="flex justify-between gap-3"><dt className="text-muted">Author</dt><dd>{broadcast.author}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted">Type</dt><dd className="break-words text-right">{broadcast.type}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted">Target</dt><dd className="break-words text-right">{broadcast.target}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted">Status</dt><dd>{broadcast.status}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted">Reports</dt><dd>{broadcast.reportCount}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted">Sightings</dt><dd>{broadcast.sightingsCount}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted">Delivery</dt><dd>{broadcast.delivery}</dd></div>
                  </dl>
                  <div className="mt-4 grid gap-4 border-t border-line pt-4">
                    <BroadcastModerationActions
                      broadcastId={broadcast.id}
                      status={broadcast.status}
                      adminVerified={broadcast.adminVerified}
                      authorLabel={broadcast.authorLabel}
                    />
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
              ))}
            </div>
          </>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="min-w-0 rounded-lg border border-line bg-surface p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-ink">Approval rules</h3>
          <p className="mt-2 break-words text-sm text-muted">Government, community, missing person, and stolen vehicle broadcasts require admin approval. Verified critical P1 incidents can auto-publish to nearby users.</p>
        </article>
        <article className="min-w-0 rounded-lg border border-line bg-surface p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-ink">Geofence delivery</h3>
          <p className="mt-2 break-words text-sm text-muted">PostGIS target areas and radius geofences filter recipients. Only users near the affected area receive push alerts.</p>
        </article>
        <article className="min-w-0 rounded-lg border border-line bg-surface p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-ink">Audit</h3>
          <p className="mt-2 break-words text-sm text-muted">Approve, reject, schedule, dispatch, and cancellation actions are recorded through the broadcasts API and audit service.</p>
        </article>
      </section>
    </div>
  );
}
