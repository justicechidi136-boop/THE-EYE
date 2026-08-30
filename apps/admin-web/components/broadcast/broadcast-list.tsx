import Link from "next/link";
import type { BroadcastView } from "../../lib/types/admin-views";
import { broadcastApprovalLabel, broadcastAuthor, broadcastPublicReference, compactBroadcastType } from "../../lib/broadcast-list-presentation";
import { humanPriority } from "../../lib/admin-presentation";
import { ConsoleEmptyState } from "../console";
import { StatusBadge } from "../ui";
import { BroadcastListActions } from "./broadcast-list-actions";

type Pagination = { page: number; limit: number; total: number; pageCount: number };
type FilterState = Record<string, string | undefined>;

function priorityTone(priority: string): "danger" | "warning" | "neutral" {
  return priority === "HIGH" ? "danger" : priority === "MID" ? "warning" : "neutral";
}

function pageHref(page: number, filters?: FilterState) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters ?? {})) {
    if (value && key !== "page") params.set(key, value);
  }
  params.set("page", String(page));
  return `/broadcasts?${params.toString()}`;
}

function visiblePages(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const values = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...values].filter((value) => value >= 1 && value <= total).sort((a, b) => a - b);
  const pages: Array<number | "ellipsis"> = [];
  sorted.forEach((value, index) => {
    if (index && value - sorted[index - 1] > 1) pages.push("ellipsis");
    pages.push(value);
  });
  return pages;
}

export function BroadcastList({
  broadcasts,
  pagination,
  filterState,
}: {
  broadcasts: BroadcastView[];
  pagination: Pagination;
  filterState?: FilterState;
}) {
  const first = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const last = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="grid min-w-0 gap-4">
      {!broadcasts.length ? <ConsoleEmptyState title="No broadcasts found" detail="Adjust the search or filters to see broadcasts in your jurisdiction." /> : (
        <>
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full min-w-[980px] table-fixed text-left text-sm">
              <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                <tr>
                  <th className="w-[25%] px-4 py-3">Broadcast</th>
                  <th className="w-[15%] px-4 py-3">Author</th>
                  <th className="w-[11%] px-4 py-3">Type</th>
                  <th className="w-[18%] px-4 py-3">Target</th>
                  <th className="w-[11%] px-4 py-3">Status</th>
                  <th className="w-[20%] px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {broadcasts.map((broadcast) => {
                  const priority = humanPriority(broadcast.severity);
                  return (
                    <tr key={broadcast.id} className="align-middle hover:bg-surfaceMuted/40">
                      <td className="px-4 py-3">
                        <p className="line-clamp-2 font-semibold text-ink">{broadcast.title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono text-muted">{broadcastPublicReference(broadcast.id)}</span>
                          <StatusBadge tone={priorityTone(priority)}>{priority}</StatusBadge>
                          <span className="text-muted">{broadcastApprovalLabel(broadcast)}</span>
                        </div>
                      </td>
                      <td className="break-words px-4 py-3">{broadcastAuthor(broadcast)}</td>
                      <td className="px-4 py-3"><span className="rounded bg-surfaceMuted px-2 py-1 text-xs font-medium">{compactBroadcastType(broadcast.type)}</span></td>
                      <td className="break-words px-4 py-3 text-muted">{broadcast.target}</td>
                      <td className="px-4 py-3"><StatusBadge tone={broadcast.status === "Published" || broadcast.status === "Active" ? "success" : "info"}>{broadcast.status}</StatusBadge></td>
                      <td className="px-4 py-3"><BroadcastListActions broadcastId={broadcast.id} status={broadcast.status} adminVerified={broadcast.adminVerified} authorLabel={broadcast.authorLabel} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 xl:hidden">
            {broadcasts.map((broadcast) => {
              const priority = humanPriority(broadcast.severity);
              return (
                <article key={broadcast.id} className="min-w-0 rounded-lg border border-line bg-surfaceMuted p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-semibold text-ink">{broadcast.title}</p>
                      <p className="mt-1 font-mono text-xs text-muted">{broadcastPublicReference(broadcast.id)}</p>
                    </div>
                    <StatusBadge tone={priorityTone(priority)}>{priority}</StatusBadge>
                  </div>
                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs uppercase text-muted">Author</dt><dd className="mt-1 break-words">{broadcastAuthor(broadcast)}</dd></div>
                    <div><dt className="text-xs uppercase text-muted">Type</dt><dd className="mt-1">{compactBroadcastType(broadcast.type)}</dd></div>
                    <div><dt className="text-xs uppercase text-muted">Target</dt><dd className="mt-1 break-words">{broadcast.target}</dd></div>
                    <div><dt className="text-xs uppercase text-muted">Status</dt><dd className="mt-1">{broadcast.status}</dd></div>
                  </dl>
                  <div className="mt-4 border-t border-line pt-4"><BroadcastListActions broadcastId={broadcast.id} status={broadcast.status} adminVerified={broadcast.adminVerified} authorLabel={broadcast.authorLabel} /></div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm">
        <p className="text-muted">Showing {first}–{last} of {pagination.total}</p>
        <nav className="flex items-center gap-2" aria-label="Broadcast pages">
          {pagination.page > 1 ? <Link className="rounded-md border border-line px-3 py-2 font-medium" href={pageHref(pagination.page - 1, filterState)}>Previous</Link> : <span className="rounded-md border border-line px-3 py-2 text-muted opacity-50">Previous</span>}
          {visiblePages(pagination.page, pagination.pageCount).map((page, index) => page === "ellipsis"
            ? <span key={`ellipsis-${index}`} className="px-1 text-muted">…</span>
            : <Link key={page} aria-current={page === pagination.page ? "page" : undefined} className={`min-w-9 rounded-md border px-3 py-2 text-center font-semibold ${page === pagination.page ? "border-eye bg-eye text-white" : "border-line text-ink"}`} href={pageHref(page, filterState)}>{page}</Link>)}
          {pagination.page < pagination.pageCount ? <Link className="rounded-md border border-line px-3 py-2 font-medium" href={pageHref(pagination.page + 1, filterState)}>Next</Link> : <span className="rounded-md border border-line px-3 py-2 text-muted opacity-50">Next</span>}
        </nav>
      </div>
    </div>
  );
}
