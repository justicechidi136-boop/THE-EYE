import { IncidentStatus } from "./enums";

const STATUS_LABELS: Record<string, string> = {
  [IncidentStatus.Submitted]: "Report submitted",
  [IncidentStatus.Received]: "Report received",
  [IncidentStatus.Verifying]: "Verification in progress",
  [IncidentStatus.Verified]: "Report verified",
  [IncidentStatus.Assigned]: "Agency assigned",
  [IncidentStatus.Responding]: "Responders en route",
  [IncidentStatus.UnderControl]: "Situation under control",
  [IncidentStatus.CancellationRequested]: "Cancellation under review",
  [IncidentStatus.Resolved]: "Resolved",
  [IncidentStatus.Closed]: "Closed",
  [IncidentStatus.FalseReport]: "Marked as invalid",
  [IncidentStatus.CancelledByReporter]: "Cancelled",
  [IncidentStatus.ExpiredAfterReview]: "Expired after review",
};

const TIMELINE_MESSAGE_OVERRIDES: Record<string, string> = {
  AutomaticTriageCompleted: "Your report has been routed to the appropriate response team",
  IncidentTriaged: "Your report has been reviewed",
  EmergencyReportSubmittedThroughFastPath: "Your emergency report has been received.",
  LowConfidence: "Your report is being verified",
};

const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  Pending: "Awaiting response",
  Accepted: "Responder assigned",
  EnRoute: "En route",
  OnScene: "On scene",
  Completed: "Completed",
  Cancelled: "Cancelled",
  Declined: "Declined",
  Reassigned: "Reassigned",
};

const PROGRESS_STAGE_STATE_LABELS: Record<string, string> = {
  pending: "Pending",
  current: "In progress",
  complete: "Complete",
  skipped: "Skipped",
};

export function citizenIncidentStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? "Update received";
}

export function citizenTimelineMessage(input: {
  eventType?: string | null;
  message?: string | null;
}): string {
  const eventType = input.eventType?.trim();
  if (eventType && TIMELINE_MESSAGE_OVERRIDES[eventType]) {
    return TIMELINE_MESSAGE_OVERRIDES[eventType];
  }
  const message = input.message?.trim();
  if (!message) return "Update received";
  if (/^[0-9a-f-]{36}$/i.test(message)) return "Update received";
  if (message.includes("LowConfidence")) return "Your report is being verified";
  if (message.includes("Automatic triage completed")) {
    return "Your report has been routed to the appropriate response team";
  }
  if (message.includes("Emergency report submitted through fast path")) {
    return "Your emergency report has been received.";
  }
  return message;
}

export function citizenAssignmentStatusLabel(status: string): string {
  return ASSIGNMENT_STATUS_LABELS[status] ?? "Update received";
}

export function citizenProgressStageStateLabel(state: string): string {
  return PROGRESS_STAGE_STATE_LABELS[state] ?? "Update received";
}

export function citizenLocationQualityLabel(input: {
  quality?: string | null;
  source?: string | null;
  latitude?: string | null;
  longitude?: string | null;
}): string {
  const quality = input.quality?.toLowerCase() ?? "";
  if (quality.includes("low") || quality.includes("approx")) {
    return "Approximate location";
  }
  if (input.latitude && input.longitude) {
    return "Location recorded";
  }
  return "Location pending";
}

export function citizenIncidentCategoryLabel(type: string): string {
  return type
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}

export function citizenWitnessSummary(input: {
  witnessCount?: number | null;
  latestConfidence?: string | null;
}): string | null {
  const count = input.witnessCount ?? 0;
  if (count <= 0) return "Awaiting community verification";
  return `${count} community ${count === 1 ? "witness" : "witnesses"}`;
}

export function formatCitizenDateTime(value: Date | string, now = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (sameDay) return `Today, ${time}`;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatCitizenEmailTimestamp(value: Date | string, now = new Date()): string {
  return formatCitizenDateTime(value, now);
}
