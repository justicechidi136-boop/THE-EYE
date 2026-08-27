"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ADMIN_MEDIA_ACCEPT,
  displayEvidenceLabel,
  mediaTypeFromContentType,
  validateAdminEvidenceSelection,
  type AdminEvidenceItem,
  type AdminMediaType,
} from "../lib/admin-media";
import { Button, InlineAlert } from "./form-primitives";

export type SelectedEvidenceFile = {
  id: string;
  file: File;
  mediaType: AdminMediaType;
  previewUrl: string;
  status: "Selected" | "Uploading" | "Uploaded" | "Failed";
};

type EvidencePickerProps = {
  label: string;
  allowedTypes: AdminMediaType[];
  files: SelectedEvidenceFile[];
  onChange: (files: SelectedEvidenceFile[]) => void;
  disabled?: boolean;
};

export function EvidencePicker({ label, allowedTypes, files, onChange, disabled }: EvidencePickerProps) {
  const [error, setError] = useState<string | null>(null);
  const filesRef = useRef(files);
  const accept = allowedTypes
    .map((type) => type === "Image" ? ADMIN_MEDIA_ACCEPT.image : type === "Video" ? ADMIN_MEDIA_ACCEPT.video : ADMIN_MEDIA_ACCEPT.audio)
    .join(",");

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => () => {
    for (const item of filesRef.current) URL.revokeObjectURL(item.previewUrl);
  }, []);

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const incoming = Array.from(fileList);
    const validationError = validateAdminEvidenceSelection([...files.map((item) => item.file), ...incoming], allowedTypes);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onChange([
      ...files,
      ...incoming.map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        mediaType: mediaTypeFromContentType(file.type)!,
        previewUrl: URL.createObjectURL(file),
        status: "Selected" as const,
      })),
    ]);
  }

  function removeFile(id: string) {
    const removed = files.find((item) => item.id === id);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    onChange(files.filter((item) => item.id !== id));
  }

  return (
    <section className="grid gap-3 rounded-lg border border-line bg-surfaceMuted p-4 md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{label}</h3>
          <p className="mt-1 text-xs text-muted">Selected evidence is uploaded only after the case is created.</p>
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-surfaceMuted focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-eye">
          Select media
          <input
            className="sr-only"
            type="file"
            multiple
            accept={accept}
            disabled={disabled}
            onChange={(event) => {
              addFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>
      {error ? <InlineAlert>{error}</InlineAlert> : null}
      {files.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {files.map((item) => (
            <article key={item.id} className="min-w-0 rounded-lg border border-line bg-surface p-3">
              <EvidencePreviewSurface item={{ type: item.mediaType, contentType: item.file.type, url: item.previewUrl, name: item.file.name }} />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{item.file.name}</p>
                  <p className="text-xs text-muted">{item.mediaType} · {Math.ceil(item.file.size / 1024)} KB · {item.status}</p>
                </div>
                <Button type="button" variant="secondary" disabled={disabled} onClick={() => removeFile(item.id)}>
                  Remove
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-line bg-surface px-3 py-4 text-sm text-muted">No evidence selected.</p>
      )}
    </section>
  );
}

type EvidenceGalleryProps = {
  title?: string;
  incidentId?: string;
  mediaAccessPath?: (mediaId: string) => string;
  items: AdminEvidenceItem[];
};

export function EvidenceGallery({ title = "Evidence", incidentId, mediaAccessPath, items }: EvidenceGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = activeIndex == null ? null : items[activeIndex] ?? null;
  const activeUrl = active ? active.url ?? active.signedUrl ?? (active.id ? signedUrls[active.id] : undefined) : undefined;
  const canShowPrevious = activeIndex != null && activeIndex > 0;
  const canShowNext = activeIndex != null && activeIndex < items.length - 1;

  async function openItem(index: number, forceRefresh = false) {
    const item = items[index];
    setActiveIndex(index);
    setError(null);
    const accessPath = item.id
      ? mediaAccessPath?.(item.id) ?? (incidentId ? `/api/admin/incidents/${incidentId}/media/${item.id}/view` : null)
      : null;
    if (item.url || item.signedUrl || !accessPath || !item.id || (!forceRefresh && signedUrls[item.id])) return;
    setLoadingId(item.id);
    try {
      const response = await fetch(accessPath);
      const payload = (await response.json()) as { signedUrl?: string; message?: string };
      if (!response.ok || !payload.signedUrl) throw new Error(payload.message ?? "Evidence preview unavailable");
      setSignedUrls((current) => ({ ...current, [item.id!]: payload.signedUrl! }));
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Evidence preview failed");
    } finally {
      setLoadingId(null);
    }
  }

  const activeLabel = active ? displayEvidenceLabel(active) : "";

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <span className="text-xs font-semibold text-muted">{items.length} item{items.length === 1 ? "" : "s"}</span>
      </div>
      {items.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item, index) => (
            <button
              key={`${item.id ?? item.url ?? item.label ?? index}`}
              type="button"
              className="min-w-0 rounded-lg border border-line bg-surfaceMuted p-3 text-left transition hover:border-eye focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eye"
              onClick={() => openItem(index)}
            >
              <EvidencePreviewSurface item={item} compact />
              <p className="mt-2 truncate text-sm font-semibold text-ink">{displayEvidenceLabel(item)}</p>
              <p className="text-xs text-muted">{item.contentType ?? item.type}</p>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-line bg-surfaceMuted px-3 py-4 text-sm text-muted">No evidence attached.</p>
      )}
      {active ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={activeLabel}
          onClick={() => setActiveIndex(null)}
        >
          <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-lg border border-line bg-surface p-4 shadow-soft" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-ink">{activeLabel}</h3>
                <p className="text-xs text-muted">{active.contentType ?? active.type}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" disabled={!canShowPrevious} onClick={() => void openItem(activeIndex! - 1)}>Previous</Button>
                <Button type="button" variant="secondary" disabled={!canShowNext} onClick={() => void openItem(activeIndex! + 1)}>Next</Button>
                {active.id && (mediaAccessPath || incidentId) ? <Button type="button" variant="secondary" disabled={loadingId === active.id} onClick={() => void openItem(activeIndex!, true)}>Refresh access</Button> : null}
                <Button type="button" variant="secondary" onClick={() => setActiveIndex(null)}>Close</Button>
              </div>
            </div>
            {loadingId ? <p className="rounded-md bg-surfaceMuted px-3 py-6 text-center text-sm text-muted">Loading evidence preview...</p> : null}
            {error ? <InlineAlert>{error}</InlineAlert> : null}
            {!loadingId && !error ? <EvidencePreviewSurface item={{ ...active, url: activeUrl }} large /> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function EvidencePreviewSurface({ item, compact = false, large = false }: { item: AdminEvidenceItem; compact?: boolean; large?: boolean }) {
  const url = item.url ?? item.signedUrl;
  const mediaType = useMemo(() => {
    if (item.type === "Image" || item.contentType?.startsWith("image/")) return "image";
    if (item.type === "Video" || item.contentType?.startsWith("video/")) return "video";
    if (item.type === "Audio" || item.contentType?.startsWith("audio/")) return "audio";
    return "other";
  }, [item.contentType, item.type]);
  const frameClass = large ? "min-h-[320px]" : compact ? "h-32" : "h-44";

  if (!url) {
    return <div className={`${frameClass} grid place-items-center rounded-md border border-line bg-surface text-sm text-muted`}>Preview unavailable</div>;
  }
  if (mediaType === "image") {
    return <img src={url} alt={displayEvidenceLabel(item)} className={`${frameClass} w-full rounded-md bg-command object-contain`} />;
  }
  if (mediaType === "video") {
    return <video src={url} controls className={`${frameClass} w-full rounded-md bg-command object-contain`} />;
  }
  if (mediaType === "audio") {
    return (
      <div className={`${frameClass} grid content-center gap-3 rounded-md border border-line bg-surface p-3`}>
        <p className="text-sm font-semibold text-ink">{displayEvidenceLabel(item)}</p>
        <audio src={url} controls className="w-full">
          <track kind="captions" />
        </audio>
      </div>
    );
  }
  return <div className={`${frameClass} grid place-items-center rounded-md border border-line bg-surface text-sm text-muted`}>Unsupported preview type</div>;
}

export async function uploadIncidentEvidence(incidentId: string, files: SelectedEvidenceFile[]) {
  for (const item of files) {
    item.status = "Uploading";
    const presignResponse = await fetch(`/api/admin/incidents/${incidentId}/media/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: item.file.name,
        contentType: item.file.type,
        mediaType: item.mediaType,
        sizeBytes: item.file.size,
      }),
    });
    const presign = (await presignResponse.json()) as {
      bucket?: string;
      objectKey?: string;
      uploadUrl?: string;
      requiredHeaders?: Record<string, string>;
      message?: string;
    };
    if (!presignResponse.ok || !presign.uploadUrl || !presign.bucket || !presign.objectKey) {
      throw new Error(presign.message ?? `Unable to prepare ${item.file.name}`);
    }
    const headers = new Headers(presign.requiredHeaders ?? {});
    if (!headers.has("content-type")) headers.set("content-type", item.file.type);
    const uploadResponse = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers,
      body: item.file,
    });
    if (!uploadResponse.ok) throw new Error(`Upload failed for ${item.file.name}`);
    const confirmResponse = await fetch(`/api/admin/incidents/${incidentId}/media/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaType: item.mediaType,
        bucket: presign.bucket,
        objectKey: presign.objectKey,
        contentType: item.file.type,
        sizeBytes: item.file.size,
        fileHash: await sha256Hex(item.file),
        capturedAt: new Date(item.file.lastModified || Date.now()).toISOString(),
        metadata: { originalFileName: item.file.name, source: "admin_dashboard_case_create" },
        clientAttachmentId: item.id,
      }),
    });
    const confirmed = (await confirmResponse.json().catch(() => null)) as { message?: string } | null;
    if (!confirmResponse.ok) throw new Error(confirmed?.message ?? `Unable to attach ${item.file.name}`);
    item.status = "Uploaded";
  }
}

async function sha256Hex(file: File) {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
