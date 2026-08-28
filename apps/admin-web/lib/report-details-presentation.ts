import { buildIncidentPublicReference } from "@the-eye/shared";
import type { EvidenceAccessEntry, Incident } from "./types/admin-views";
import { formatReportCapturedAt, reportReporterLabel, reportTypeLabel } from "./report-centre-presentation";

export type ReportTimelineEntry = {
  at?: string;
  type?: string;
  label?: string;
  silent?: boolean;
  details?: { media?: { id?: string; mediaType?: string; contentType?: string } };
};

export type ReportActivityItem = {
  at?: string;
  label: string;
  category: "progress" | "evidence" | "admin";
};

export function reportPublicReference(report: Pick<Incident, "id" | "createdAt">) {
  return buildIncidentPublicReference({ incidentId: report.id, submittedAt: report.createdAt ?? new Date(0) });
}

export function reportDetailsTitle(report: Incident) {
  return `${reportTypeLabel(report.type)} report — ${report.location}`;
}

export function evidenceDisplayLabel(item: Pick<Incident["evidence"][number], "type" | "contentType">) {
  const type = item.type.toLowerCase();
  const contentType = item.contentType?.toLowerCase() ?? "";
  if (type === "image" || type === "photo" || contentType.startsWith("image/")) return "Photo Evidence";
  if (type === "video" || contentType.startsWith("video/")) return "Video Evidence";
  if (type === "audio" || type === "voice" || contentType.startsWith("audio/")) return "Voice Evidence";
  return "Evidence";
}

function humanTimelineLabel(entry: ReportTimelineEntry, reportType: string) {
  const type = entry.type?.toLowerCase() ?? "";
  if (type.includes("submitted")) return `${reportTypeLabel(reportType)} report submitted`;
  if (type.includes("triage")) return "Report entered triage";
  if (type.includes("verification")) return "Report verification updated";
  if (type.includes("media") || type.includes("evidence")) {
    return evidenceDisplayLabel({ type: entry.details?.media?.mediaType ?? "Evidence", contentType: entry.details?.media?.contentType });
  }
  if (type.includes("assigned") || type.includes("assignment")) return "Response agency assigned";
  if (type.includes("resolved")) return "Report resolved";
  if (type.includes("closed")) return "Report closed";
  const label = entry.label?.trim();
  if (label && !label.includes(".")) return label.replace(/\bIncident\b/g, "Report").replace(/\bincident\b/g, "report");
  return "Report updated";
}

function activityCategory(entry: ReportTimelineEntry): ReportActivityItem["category"] {
  const type = entry.type?.toLowerCase() ?? "";
  if (type.includes("media") || type.includes("evidence") || type.includes("audio") || type.includes("voice") || type.includes("video") || type.includes("photo")) return "evidence";
  if (type.includes("admin") || type.includes("assign") || type.includes("dispatch") || type.includes("status")) return "admin";
  return "progress";
}

export function buildReportActivity(entries: ReportTimelineEntry[], reportType: string): ReportActivityItem[] {
  const seen = new Set<string>();
  const result: ReportActivityItem[] = [];
  for (const entry of entries) {
    const label = humanTimelineLabel(entry, reportType);
    const category = activityCategory(entry);
    const semanticType = entry.type?.toLowerCase().includes("submitted") ? "submitted" : `${category}:${label.toLowerCase()}`;
    const mediaId = entry.details?.media?.id ?? "";
    const key = mediaId ? `${semanticType}:${mediaId}` : semanticType;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ at: entry.at, label, category });
  }
  return result;
}

function evidenceLabelFromIdentifier(value: string) {
  const normalized = value.toLowerCase();
  if (/\.(jpe?g|png|webp|heic)(\?|$)/.test(normalized)) return "Photo Evidence";
  if (/\.(mp4|mov|webm|mkv)(\?|$)/.test(normalized)) return "Video Evidence";
  if (/\.(m4a|mp3|wav|aac|ogg)(\?|$)/.test(normalized)) return "Voice Evidence";
  return "Evidence";
}

export function evidenceAccessSentence(entry: EvidenceAccessEntry, report: Incident) {
  const actor = entry.actor === "user"
    ? reportReporterLabel(report)
    : entry.actor === "admin"
      ? "Administrator"
      : entry.actor === "anonymous"
        ? "Anonymous reporter"
        : entry.actor === "system"
          ? "System"
          : "Authorized user";
  return `${actor} ${entry.action.toLowerCase()} ${evidenceLabelFromIdentifier(entry.file)}`;
}

export function summarizeEvidenceAccess(entries: EvidenceAccessEntry[], report: Incident, limit = 12) {
  const seen = new Set<string>();
  const result: Array<{ sentence: string; time: string }> = [];
  for (const entry of entries) {
    const sentence = evidenceAccessSentence(entry, report);
    const key = `${sentence}:${entry.time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ sentence, time: entry.time });
    if (result.length >= limit) break;
  }
  return result;
}

export { formatReportCapturedAt };
