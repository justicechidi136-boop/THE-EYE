export type AdminMediaType = "Image" | "Video" | "Audio";

export type AdminEvidenceItem = {
  id?: string;
  type: string;
  name?: string;
  label?: string;
  contentType?: string;
  signedUrl?: string;
  url?: string;
  durationSeconds?: number | null;
  uploadedAt?: string | null;
};

export type BroadcastAttachmentView = {
  id?: string;
  mediaType: string;
  label: string;
  contentType?: string;
  url?: string;
};

export const ADMIN_MEDIA_ACCEPT = {
  image: "image/jpeg,image/png,image/webp",
  video: "video/mp4,video/webm",
  audio: "audio/mpeg,audio/mp4,audio/webm,audio/aac,audio/x-m4a",
} as const;

export const ADMIN_MEDIA_LIMITS = {
  Image: 6,
  Video: 2,
  Audio: 2,
} as const;

const allowedContentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/webm",
  "audio/aac",
  "audio/x-m4a",
]);

export function mediaTypeFromContentType(contentType: string): AdminMediaType | null {
  if (contentType.startsWith("image/")) return "Image";
  if (contentType.startsWith("video/")) return "Video";
  if (contentType.startsWith("audio/")) return "Audio";
  return null;
}

export function validateAdminEvidenceSelection(
  files: Array<{ type: string; size: number }>,
  allowedTypes: AdminMediaType[],
) {
  const counts: Record<AdminMediaType, number> = { Image: 0, Video: 0, Audio: 0 };
  for (const file of files) {
    const mediaType = mediaTypeFromContentType(file.type);
    if (!mediaType || !allowedTypes.includes(mediaType) || !allowedContentTypes.has(file.type)) {
      return `Unsupported evidence type: ${file.type || "unknown"}`;
    }
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > 100 * 1024 * 1024) {
      return "Evidence file size must be between 1 byte and 100 MB";
    }
    counts[mediaType] += 1;
    if (counts[mediaType] > ADMIN_MEDIA_LIMITS[mediaType]) {
      return `At most ${ADMIN_MEDIA_LIMITS[mediaType]} ${mediaType.toLowerCase()} file(s) can be attached`;
    }
  }
  return null;
}

export function displayEvidenceLabel(item: AdminEvidenceItem) {
  const label = item.label?.trim() || item.name?.trim();
  if (label && !label.startsWith("evidence/")) return label;
  if (item.type === "Image" || item.contentType?.startsWith("image/")) return "Photo evidence";
  if (item.type === "Video" || item.contentType?.startsWith("video/")) return "Video evidence";
  if (item.type === "Audio" || item.contentType?.startsWith("audio/")) return "Voice evidence";
  return "Evidence";
}

export function normalizeBroadcastAttachments(raw: unknown): BroadcastAttachmentView[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: item.id ? String(item.id) : undefined,
      mediaType: String(item.mediaType ?? ""),
      label: String(item.label ?? "Attachment"),
      contentType: item.contentType ? String(item.contentType) : undefined,
      url: item.url ? String(item.url) : undefined,
    }))
    .filter((item) => ["image", "video", "audio"].includes(item.mediaType.toLowerCase()));
}
