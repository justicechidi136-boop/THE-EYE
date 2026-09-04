import type { Incident } from "./types/admin-views";

export const REPORT_TYPE_OPTIONS = [
  { value: "Emergency", label: "Emergency" },
  { value: "Crime", label: "Crime" },
  { value: "Accident", label: "Accident" },
  { value: "Fire", label: "Fire" },
  { value: "Kidnapping", label: "Kidnapping" },
  { value: "Abuse", label: "Abuse" },
  { value: "SuspiciousActivity", label: "Suspicious Activity" },
  { value: "SOS", label: "SOS" },
] as const;

export function reportTypeLabel(type: string) {
  return REPORT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function reportReporterLabel(report: Incident) {
  return report.reporter.anonymous ? "Anonymous" : report.reporter.label;
}

export function formatReportCapturedAt(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return "Time unavailable";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

export function relativeReportTime(value?: string, now = Date.now()) {
  if (!value || Number.isNaN(Date.parse(value))) return "Time unavailable";
  const elapsedSeconds = Math.max(0, Math.floor((now - Date.parse(value)) / 1000));
  if (elapsedSeconds < 60) return "Just now";
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function reportPaginationItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const ordered = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  ordered.forEach((page, index) => {
    if (index > 0 && page - ordered[index - 1]! > 1) result.push("ellipsis");
    result.push(page);
  });
  return result;
}

export function parseCursorHistory(value?: string) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

export function encodeCursorHistory(values: string[]) {
  return Buffer.from(JSON.stringify(values), "utf8").toString("base64url");
}
