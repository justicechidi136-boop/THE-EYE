import { formatCitizenEmailTimestamp } from "@the-eye/shared";

const APPROVED_AGE_RANGES = new Set([
  "0–5",
  "6–9",
  "10–15",
  "16–17",
  "18–25",
  "26–40",
  "41–60",
  "60+",
  "0-5",
  "6-9",
  "10-15",
  "16-17",
  "18-25",
  "26-40",
  "41-60",
]);

export function normalizeMissingPersonAge(value: string): string {
  return value.trim().replace(/-/g, "–");
}

export function isExactMissingPersonAge(value: string): boolean {
  const trimmed = value.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return false;
  const age = Number(trimmed);
  return Number.isInteger(age) && age >= 0 && age <= 120;
}

export function isApprovedMissingPersonAgeRange(value: string): boolean {
  return APPROVED_AGE_RANGES.has(value.trim()) || APPROVED_AGE_RANGES.has(normalizeMissingPersonAge(value));
}

export function assertValidMissingPersonAge(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("ageOrApproximateAge is required");
  if (isExactMissingPersonAge(trimmed)) return trimmed;
  if (isApprovedMissingPersonAgeRange(trimmed)) return normalizeMissingPersonAge(trimmed);
  throw new Error("ageOrApproximateAge must be an exact age or approved range");
}

export function buildMissingPersonBroadcastPreview(input: {
  fullName: string;
  ageOrApproximateAge: string;
  lastSeenAt: string;
}): string {
  const name = input.fullName.trim();
  const age = normalizeMissingPersonAge(input.ageOrApproximateAge);
  const lastSeen = formatCitizenEmailTimestamp(new Date(input.lastSeenAt));
  if (isExactMissingPersonAge(age)) {
    return `${age}-year-old ${name} was last seen on ${lastSeen}.`;
  }
  return `${name}, approximately ${age} years old, was last seen on ${lastSeen}.`;
}

export function reportSubmittedNotificationCopy(publicReference: string, incidentType: string) {
  const incidentLabel = resolveCitizenIncidentTypeLabel(incidentType);
  const reportType = incidentLabel.toLowerCase();
  return {
    type: "IncidentStatusUpdate" as const,
    title: `Your ${reportType} report has been received`,
    body: `Your ${reportType} report ${publicReference} has been successfully submitted.`,
    metadata: {
      route: "OWN_ACTIVE_INCIDENT",
      publicReference,
      citizenCategory: "Report Submitted",
      incidentCategory: incidentLabel,
      notificationTemplateKey: "report.submitted",
      notificationParams: {
        reportType,
        publicReference,
      },
    },
  };
}

export function verifyActiveIncidentNotificationCopy() {
  return verifyActiveIncidentNotificationCopyForType("Emergency");
}

export function verifyActiveIncidentNotificationCopyForType(incidentType: string) {
  const incidentLabel = resolveCitizenIncidentTypeLabel(incidentType);
  const noun = incidentLabel.toLowerCase();
  const title =
    incidentLabel === "Emergency"
      ? "Can you confirm this emergency?"
      : `Can you confirm this ${noun}?`;
  const body =
    incidentLabel === "Emergency"
      ? "An emergency has been reported near your location."
      : `${incidentLabel === "Suspicious Activity" ? "Suspicious activity" : `A ${noun}`} has been reported near your location.`;
  return {
    type: "NearbyIncidentVerification" as const,
    title,
    body,
    metadata: {
      route: "COMMUNITY_VERIFICATION",
      citizenCategory: "Verify Active Incident",
      incidentCategory: incidentLabel,
    },
  };
}

export function resolveCitizenIncidentTypeLabel(incidentType: string): string {
  const normalized = incidentType.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  switch (normalized) {
    case "emergency":
    case "emergencycase":
      return "Emergency";
    case "accident":
      return "Accident";
    case "fire":
      return "Fire";
    case "suspiciousactivity":
      return "Suspicious Activity";
    case "abuse":
      return "Abuse";
    case "kidnapping":
      return "Kidnapping";
    case "crime":
      return "Crime";
    case "liveemergencyvideo":
    case "livevideo":
      return "Live Emergency Video";
    default:
      return incidentType.trim().length === 0 ? "Emergency" : incidentType.trim();
  }
}

export const CANCELLATION_REASON_CODES = [
  "EMERGENCY_RESOLVED",
  "REPORTED_BY_MISTAKE",
  "I_AM_SAFE_NOW",
  "HELP_NO_LONGER_NEEDED",
  "OTHER",
] as const;

export type CancellationReasonCode = (typeof CANCELLATION_REASON_CODES)[number];

const CANCELLATION_LABELS: Record<CancellationReasonCode, string> = {
  EMERGENCY_RESOLVED: "Emergency resolved",
  REPORTED_BY_MISTAKE: "Reported by mistake",
  I_AM_SAFE_NOW: "I am safe now",
  HELP_NO_LONGER_NEEDED: "Help is no longer needed",
  OTHER: "Other",
};

export function resolveCancellationReason(body: {
  reason?: string;
  reasonCode?: string;
  reasonText?: string;
}): { reason: string; reasonCode?: CancellationReasonCode; reasonText?: string | null } {
  const code = String(body.reasonCode ?? "").trim().toUpperCase() as CancellationReasonCode;
  if (code && (CANCELLATION_REASON_CODES as readonly string[]).includes(code)) {
    if (code === "OTHER") {
      const text = String(body.reasonText ?? body.reason ?? "").trim();
      if (!text) throw new Error("Please enter a reason.");
      return { reason: `Other: ${text}`, reasonCode: code, reasonText: text };
    }
    return {
      reason: CANCELLATION_LABELS[code],
      reasonCode: code,
      reasonText: null,
    };
  }
  const legacy = String(body.reason ?? "").trim();
  if (!legacy) throw new Error("Select a reason for cancelling this emergency.");
  return { reason: legacy };
}
