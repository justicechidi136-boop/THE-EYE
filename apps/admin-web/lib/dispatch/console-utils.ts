import type { DispatchIncident, DispatchResponder } from "../api/dispatch";
import { formatDuration } from "./sla-display";

export function incidentIsSilent(incident: DispatchIncident): boolean {
  const metadata = incident.metadata ?? {};
  return metadata.silent === true || metadata.emergencyCategory === "SilentSos";
}

export function secondsSinceSubmitted(incident: DispatchIncident): number | null {
  if (!incident.submittedAt) return null;
  const submittedMs = Date.parse(incident.submittedAt);
  if (Number.isNaN(submittedMs)) return null;
  return Math.max(0, Math.floor((Date.now() - submittedMs) / 1000));
}

export function priorityShort(priority: string): string {
  if (priority.startsWith("P1")) return "P1";
  if (priority.startsWith("P2")) return "P2";
  if (priority.startsWith("P3")) return "P3";
  return "P4";
}

export function priorityTone(priority: string): "danger" | "warning" | "info" | "neutral" {
  const short = priorityShort(priority);
  if (short === "P1") return "danger";
  if (short === "P2") return "warning";
  if (short === "P3") return "info";
  return "neutral";
}

export function responderAvailabilityCounts(responders: DispatchResponder[]) {
  const counts = { available: 0, busy: 0, offDuty: 0, other: 0 };
  for (const responder of responders) {
    const value = responder.availability.toLowerCase();
    if (value.includes("available")) counts.available += 1;
    else if (value.includes("busy")) counts.busy += 1;
    else if (value.includes("off")) counts.offDuty += 1;
    else counts.other += 1;
  }
  return counts;
}

export function workloadSummary(incidents: DispatchIncident[], responders: DispatchResponder[]) {
  const unassigned = incidents.filter((item) => item.status === "Verified" && !item.assignedAgencyId).length;
  const assigned = incidents.filter((item) => item.status === "Assigned").length;
  const responding = incidents.filter((item) => item.status === "Responding").length;
  const stale = incidents.filter((item) => item.liveLocationStale).length;
  const availability = responderAvailabilityCounts(responders);
  return {
    unassigned,
    assigned,
    responding,
    stale,
    responders: responders.length,
    availableResponders: availability.available,
    busyResponders: availability.busy,
  };
}

export function incidentSlaLabel(incident: DispatchIncident): string {
  const elapsed = secondsSinceSubmitted(incident);
  if (elapsed === null) return "Unknown";
  if (elapsed > 900 && incident.status === "Verified") return "Assignment SLA at risk";
  if (elapsed > 1800) return "Extended queue time";
  return formatDuration(elapsed);
}

export function incidentSlaTone(incident: DispatchIncident): "danger" | "warning" | "success" | "neutral" {
  const elapsed = secondsSinceSubmitted(incident);
  if (elapsed !== null && elapsed > 1800) return "danger";
  if (elapsed !== null && elapsed > 900 && incident.status === "Verified") return "warning";
  if (incident.liveLocationStale) return "warning";
  return "neutral";
}
