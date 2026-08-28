"use client";

import { useMemo, useState } from "react";
import type { BroadcastView } from "../../lib/types/admin-views";
import { broadcastApprovalLabel, broadcastAuthor, broadcastPublicReference, compactBroadcastType, matchesBroadcastSearch } from "../../lib/broadcast-list-presentation";
import { humanPriority } from "../../lib/admin-presentation";
import { ConsoleEmptyState } from "../console";
import { StatusBadge } from "../ui";
import { BroadcastListActions } from "./broadcast-list-actions";

const PAGE_SIZE = 10;

function priorityTone(priority: string): "danger" | "warning" | "neutral" {
  return priority === "HIGH" ? "danger" : priority === "MID" ? "warning" : "neutral";
}

function deliveryTone(delivery: string): "success" | "info" | "warning" | "neutral" {
  if (delivery === "Sent") return "success";
  if (delivery === "Failed") return "warning";
  return delivery === "Not dispatched" ? "neutral" : "info";
}

export function BroadcastList({ broadcasts }: { broadcasts: BroadcastView[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const matches = useMemo(() => broadcasts.filter((broadcast) => matchesBroadcastSearch(broadcast, query)), [broadcasts, query]);
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = matches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  return (
    <div className="grid min-w-0 gap-4">
      <label className="grid gap-2 text-sm font-medium text-ink">
        <span className="sr-only">Search broadcasts</span>
        <input className="h-11 rounded-md border border-line bg-surface px-3 outline-none focus:border-eye focus:ring-2 focus:ring-eye/20" placeholder="Search broadcasts by title, reference, author, or location…" value={query} onChange={(event) => updateQuery(event.target.value)} />
      </label>

      {!visible.length ? <ConsoleEmptyState title="No broadcasts found" detail="Adjust the search or filters to see broadcasts in your jurisdiction." /> : (
        <>
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full min-w-[1080px] table-fixed text-left text-sm">
              <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                <tr>
                  <th className="w-[22%] px-4 py-3">Broadcast</th>
                  <th className="w-[14%] px-4 py-3">Author</th>
                  <th className="w-[9%] px-4 py-3">Type</th>
                  <th className="w-[16%] px-4 py-3">Target</th>
                  <th className="w-[10%] px-4 py-3">Status</th>
                  <th className="w-[9%] px-4 py-3">Delivery</th>
                  <th className="w-[20%] px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((broadcast) => {
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
                      <td className="px-4 py-3"><StatusBadge tone={deliveryTone(broadcast.delivery)}>{broadcast.delivery}</StatusBadge></td>
                      <td className="px-4 py-3"><BroadcastListActions broadcastId={broadcast.id} status={broadcast.status} adminVerified={broadcast.adminVerified} authorLabel={broadcast.authorLabel} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 xl:hidden">
            {visible.map((broadcast) => {
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
                    <div><dt className="text-xs uppercase text-muted">Status / delivery</dt><dd className="mt-1">{broadcast.status} · {broadcast.delivery}</dd></div>
                  </dl>
                  <div className="mt-4 border-t border-line pt-4"><BroadcastListActions broadcastId={broadcast.id} status={broadcast.status} adminVerified={broadcast.adminVerified} authorLabel={broadcast.authorLabel} /></div>
                </article>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm">
            <p className="text-muted">Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, matches.length)} of {matches.length}</p>
            <div className="flex items-center gap-2">
              <button className="rounded-md border border-line px-3 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
              <span className="min-w-20 text-center">Page {currentPage} of {pageCount}</span>
              <button className="rounded-md border border-line px-3 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
