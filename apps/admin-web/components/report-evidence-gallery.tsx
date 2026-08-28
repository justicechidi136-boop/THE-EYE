"use client";

import { useEffect, useMemo, useState } from "react";
import { evidenceDisplayLabel, formatReportCapturedAt } from "../lib/report-details-presentation";
import type { Incident } from "../lib/types/admin-views";

type EvidenceItem = Incident["evidence"][number];

function mediaKind(item: EvidenceItem) {
  const type = item.type.toLowerCase();
  const contentType = item.contentType?.toLowerCase() ?? "";
  if (type === "image" || type === "photo" || contentType.startsWith("image/")) return "image";
  if (type === "video" || contentType.startsWith("video/")) return "video";
  if (type === "audio" || type === "voice" || contentType.startsWith("audio/")) return "audio";
  return "other";
}

export function ReportEvidenceGallery({ incidentId, items }: { incidentId: string; items: EvidenceItem[] }) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(() => new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeImage, setActiveImage] = useState<EvidenceItem>();
  const itemKey = items.map((item) => item.id).join("|");

  async function loadUrl(item: EvidenceItem) {
    if (!item.id) return;
    setLoadingIds((current) => new Set(current).add(item.id));
    setErrors((current) => ({ ...current, [item.id]: "" }));
    try {
      const response = await fetch(`/api/admin/incidents/${incidentId}/media/${item.id}/view`);
      const payload = (await response.json()) as { signedUrl?: string; message?: string };
      if (!response.ok || !payload.signedUrl) throw new Error(payload.message ?? "Evidence access unavailable");
      setSignedUrls((current) => ({ ...current, [item.id]: payload.signedUrl! }));
    } catch (error) {
      setErrors((current) => ({ ...current, [item.id]: error instanceof Error ? error.message : "Evidence access failed" }));
    } finally {
      setLoadingIds((current) => { const next = new Set(current); next.delete(item.id); return next; });
    }
  }

  useEffect(() => {
    for (const item of items) void loadUrl(item);
    // Evidence identity changes only when the server refreshes this detail page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentId, itemKey]);

  const activeUrl = activeImage?.id ? signedUrls[activeImage.id] : undefined;
  const groups = useMemo(() => items.map((item) => ({ item, kind: mediaKind(item) })), [items]);

  if (!items.length) return <p className="rounded-lg border border-dashed border-line bg-surfaceMuted px-4 py-8 text-center text-sm text-muted">No evidence has been attached to this report.</p>;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map(({ item, kind }) => {
          const url = signedUrls[item.id];
          const loading = loadingIds.has(item.id);
          return (
            <article key={item.id} className="min-w-0 overflow-hidden rounded-lg border border-line bg-surfaceMuted">
              <div className="grid min-h-48 place-items-center bg-command/95">
                {loading ? <p className="text-sm text-white/80">Preparing secure preview…</p> : null}
                {!loading && url && !errors[item.id] && kind === "image" ? <button type="button" className="h-52 w-full" onClick={() => setActiveImage(item)} aria-label={`Open ${evidenceDisplayLabel(item)} full size`}><img src={url} alt={evidenceDisplayLabel(item)} className="h-full w-full object-contain" onError={() => setErrors((current) => ({ ...current, [item.id]: "Secure preview could not be loaded." }))} /></button> : null}
                {!loading && url && !errors[item.id] && kind === "video" ? <video src={url} controls className="h-52 w-full object-contain" onError={() => setErrors((current) => ({ ...current, [item.id]: "Secure video could not be loaded." }))}><track kind="captions" /></video> : null}
                {!loading && url && !errors[item.id] && kind === "audio" ? <div className="w-full p-4"><audio src={url} controls className="w-full" onError={() => setErrors((current) => ({ ...current, [item.id]: "Secure audio could not be loaded." }))}><track kind="captions" /></audio></div> : null}
                {!loading && (!url || errors[item.id] || kind === "other") ? <p className="p-5 text-center text-sm text-white/80">Preview unavailable</p> : null}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-ink">{evidenceDisplayLabel(item)}</h3>
                <p className="mt-1 text-xs text-muted">Uploaded {formatReportCapturedAt(item.uploadedAt ?? undefined)}{item.durationSeconds ? ` · ${item.durationSeconds}s` : ""}</p>
                {errors[item.id] ? <div className="mt-3"><p className="text-xs text-danger">{errors[item.id]}</p><button type="button" onClick={() => void loadUrl(item)} className="mt-2 text-sm font-semibold text-eye hover:underline">Retry secure access</button></div> : null}
                {kind === "audio" && item.transcript ? <div className="mt-3 rounded-md border border-line bg-surface p-3"><p className="text-xs font-semibold uppercase text-muted">AI Transcript</p><p className="mt-1 text-sm text-ink">{item.transcript}</p></div> : null}
                {kind === "audio" && item.translatedTranscript ? <div className="mt-3 rounded-md border border-line bg-surface p-3"><p className="text-xs font-semibold uppercase text-muted">AI Translation</p><p className="mt-1 text-sm text-ink">{item.translatedTranscript}</p></div> : null}
              </div>
            </article>
          );
        })}
      </div>
      {activeImage && activeUrl ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Photo Evidence preview" onClick={() => setActiveImage(undefined)}><div className="relative max-h-[92vh] w-full max-w-6xl" onClick={(event) => event.stopPropagation()}><button type="button" className="absolute right-2 top-2 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/70 text-xl text-white" aria-label="Close photo preview" onClick={() => setActiveImage(undefined)}>×</button><img src={activeUrl} alt="Photo Evidence full preview" className="max-h-[92vh] w-full object-contain" /></div></div> : null}
    </>
  );
}
