"use client";

import Link from "next/link";
import type { BroadcastView } from "../../lib/types/admin-views";
import type { AdminBroadcastMetrics, BroadcastTargetOptions } from "../../lib/api/data";
import { BroadcastCreateForm } from "../broadcast-create-form";
import { BroadcastFilters } from "./broadcast-filters";
import { BroadcastList } from "./broadcast-list";

type BroadcastWorkspaceProps = {
  broadcasts: BroadcastView[];
  metrics: AdminBroadcastMetrics;
  pagination: { page: number; limit: number; total: number; pageCount: number };
  targetOptions: BroadcastTargetOptions;
  filterDefaults?: {
    country?: string; state?: string; lga?: string; communityId?: string; status?: string;
    category?: string; author?: string; search?: string; time?: string; from?: string; to?: string; page?: string;
  };
};

export function BroadcastWorkspace({ broadcasts, metrics, pagination, targetOptions, filterDefaults }: BroadcastWorkspaceProps) {
  return (
    <div className="grid min-w-0 gap-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="min-w-0 rounded-lg border border-line bg-surface p-4 shadow-sm"><p className="text-sm text-muted">Published</p><strong className="mt-2 block text-2xl text-success">{metrics.published}</strong></article>
        <article className="min-w-0 rounded-lg border border-line bg-surface p-4 shadow-sm"><p className="text-sm text-muted">Active</p><strong className="mt-2 block text-2xl text-eye">{metrics.active}</strong></article>
        <article className="min-w-0 rounded-lg border border-line bg-surface p-4 shadow-sm"><p className="text-sm text-muted">Expired</p><strong className="mt-2 block text-2xl text-muted">{metrics.expired}</strong></article>
        <article className="min-w-0 rounded-lg border border-line bg-surface p-4 shadow-sm"><p className="text-sm text-muted">Cancelled</p><strong className="mt-2 block text-2xl text-danger">{metrics.cancelled}</strong></article>
      </section>

      <section className="rounded-lg border border-line bg-surface shadow-sm">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-ink">Create broadcast</h2>
          <p className="mt-1 text-sm text-muted">Choose an authorized geographic level and delivery scope. The API enforces the selected target.</p>
        </div>
        <div className="min-w-0 p-4"><BroadcastCreateForm targetOptions={targetOptions} /></div>
      </section>

      <section className="rounded-lg border border-line bg-surface shadow-sm">
        <div className="border-b border-line px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-base font-semibold text-ink">Broadcast list</h2><p className="mt-1 text-sm text-muted">{pagination.total} broadcasts in scope</p></div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href="/broadcasts/reports" className="rounded-md border border-line px-3 py-2 font-semibold text-ink hover:border-accent">Broadcast reports</Link>
              <Link href="/broadcasts/analytics" className="rounded-md border border-line px-3 py-2 font-semibold text-ink hover:border-accent">Analytics</Link>
            </div>
          </div>
          <div className="mt-4"><BroadcastFilters defaults={filterDefaults} targetOptions={targetOptions} /></div>
        </div>
        <div className="min-w-0 p-4"><BroadcastList broadcasts={broadcasts} pagination={pagination} filterState={filterDefaults} /></div>
      </section>

      <details className="rounded-lg border border-line bg-surface shadow-sm">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent">Broadcast rules &amp; help</summary>
        <div className="grid gap-4 border-t border-line p-4 lg:grid-cols-3">
          <div><h3 className="text-sm font-semibold">Approval rules</h3><p className="mt-2 text-sm text-muted">Government, community, missing person, and stolen vehicle broadcasts require Admin approval. Verified critical alerts can follow approved automatic publishing policy.</p></div>
          <div><h3 className="text-sm font-semibold">Geofence delivery</h3><p className="mt-2 text-sm text-muted">Location and radius are resolved to geographic targeting internally. Recipient eligibility remains server-authoritative.</p></div>
          <div><h3 className="text-sm font-semibold">Audit</h3><p className="mt-2 text-sm text-muted">Approval, dispatch, scheduling, suspension, and cancellation actions remain audited through the Broadcast API.</p></div>
        </div>
      </details>
    </div>
  );
}
