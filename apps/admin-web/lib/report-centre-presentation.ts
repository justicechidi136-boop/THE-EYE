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
