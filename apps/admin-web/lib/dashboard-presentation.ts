import type { Incident } from "./types/admin-views";

export function dashboardReporterLabel(incident?: Incident, fallback?: string) {
  if (incident?.reporter.anonymous || incident?.reportingMode === "Anonymous") {
    return "Anonymous reporter";
  }
  return incident?.reporter.label || fallback || "Identified reporter";
}

export function dashboardReportType(value?: string) {
  const normalized = (value || "Report")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  if (normalized.toUpperCase() === "SOS") return "SOS";
  return normalized.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDashboardTimestamp(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(date);
}
