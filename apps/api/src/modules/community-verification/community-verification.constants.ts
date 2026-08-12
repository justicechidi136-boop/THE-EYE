import { IncidentStatus, IncidentType } from "@the-eye/shared";

export const COMMUNITY_VERIFICATION_SAFE_PAYLOAD_VERSION = 1;
export const DEFAULT_VERIFICATION_REQUEST_TTL_MINUTES = 45;
export const DEFAULT_VERIFICATION_RADIUS_METERS = 500;
export const DEFAULT_VERIFICATION_LIMIT = 25;
export const VERIFICATION_REQUEST_COOLDOWN_MINUTES = 15;
export const MAX_LOCATION_FRESHNESS_MINUTES = 30;

export const ACTIVE_INCIDENT_STATUSES: IncidentStatus[] = [
  IncidentStatus.Submitted,
  IncidentStatus.Received,
  IncidentStatus.Verifying,
  IncidentStatus.Verified,
  IncidentStatus.Assigned,
  IncidentStatus.Responding,
  IncidentStatus.UnderControl,
  IncidentStatus.CancellationRequested,
];

export const ACTIVE_ASSIGNMENT_STATUSES = [
  "Assigned",
  "Accepted",
  "EnRoute",
  "Arrived",
  "InProgress",
] as const;

export const PASSIVE_ONLY_INCIDENT_TYPES = new Set<IncidentType>([
  IncidentType.Kidnapping,
  IncidentType.Medical,
  IncidentType.Emergency,
  IncidentType.Abuse,
  IncidentType.SOS,
  IncidentType.Fire,
]);

export const BLOCKED_INCIDENT_TYPES = new Set<IncidentType>([]);

export const RESOLUTION_ELIGIBLE_INCIDENT_TYPES = new Set<IncidentType>([
  IncidentType.SuspiciousActivity,
  IncidentType.CommunitySafety,
  IncidentType.Accident,
  IncidentType.Crime,
]);

export const INCIDENT_TYPE_DISPLAY: Record<string, string> = {
  Emergency: "Emergency",
  EmergencyCase: "Emergency",
  Crime: "Crime",
  Accident: "Accident",
  Fire: "Fire",
  Medical: "Medical Emergency",
  CommunitySafety: "Community Safety",
  Kidnapping: "Kidnapping",
  Abuse: "Abuse",
  SuspiciousActivity: "Suspicious Activity",
  LiveEmergencyVideo: "Live Emergency Video",
  MissingPerson: "Missing Person",
  StolenVehicle: "Stolen Vehicle",
  SOS: "SOS",
};

export const SAFETY_WARNING =
  "Do not approach danger or place yourself at risk. Respond only based on what you can safely observe.";

export const PASSIVE_SAFETY_NOTICE =
  "This incident may involve serious danger. Only respond based on what you can safely observe from a distance.";

export const ALL_RESPONSE_TYPES = [
  "Confirmed",
  "NotFound",
  "StillOngoing",
  "AppearsResolved",
  "UnsafeToVerify",
  "Skipped",
  "Unsure",
] as const;

export const PASSIVE_ALLOWED_RESPONSES = [
  "StillOngoing",
  "AppearsResolved",
  "UnsafeToVerify",
  "Skipped",
  "Unsure",
] as const;

export function resolveDistanceBand(distanceMeters: number | null | undefined) {
  if (distanceMeters == null || !Number.isFinite(distanceMeters)) return "BEYOND_1_KM" as const;
  if (distanceMeters <= 100) return "WITHIN_100_M" as const;
  if (distanceMeters <= 250) return "WITHIN_250_M" as const;
  if (distanceMeters <= 500) return "WITHIN_500_M" as const;
  if (distanceMeters <= 1000) return "WITHIN_1_KM" as const;
  return "BEYOND_1_KM" as const;
}

export function approximateDistanceLabel(distanceMeters: number | null | undefined) {
  if (distanceMeters == null || !Number.isFinite(distanceMeters)) return "nearby";
  if (distanceMeters < 1000) return `approximately ${Math.round(distanceMeters / 50) * 50} metres`;
  return `approximately ${(distanceMeters / 1000).toFixed(1)} km`;
}

export function sanitizePublicDescription(description: string | null | undefined, incidentType: string) {
  const base = (description ?? "").trim();
  if (!base) return `A ${INCIDENT_TYPE_DISPLAY[incidentType] ?? incidentType.toLowerCase()} incident was reported nearby.`;
  return base
    .replace(/\b\d{1,3}\.\d{3,6}\b/g, "[location redacted]")
    .replace(/\b\+?\d{10,15}\b/g, "[contact redacted]")
    .slice(0, 280);
}

export function buildApproximateArea(country: string, state: string, lga: string) {
  return `${lga}, ${state}`;
}

export function buildSpokenSummaryTemplate(input: {
  categoryDisplayLabel: string;
  approximateArea: string;
  approximateDistance: string;
  reportTime: string;
}) {
  return `A ${input.categoryDisplayLabel} was reported in ${input.approximateArea}, ${input.approximateDistance} from you, at ${input.reportTime}. ${SAFETY_WARNING}`;
}
