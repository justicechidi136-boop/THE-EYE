import { IncidentPriority, IncidentStatus, IncidentType } from "@the-eye/shared";

export const PUBLIC_ALERT_INCIDENT_TYPES = new Set<string>([
  IncidentType.Kidnapping,
  IncidentType.Crime,
  IncidentType.Emergency,
  IncidentType.Fire,
  IncidentType.Medical,
  IncidentType.CommunitySafety,
  IncidentType.SOS,
  IncidentType.Abuse,
]);

export const AUTO_ALERT_CONFIDENCE_THRESHOLD = 85;
export const MIN_INDEPENDENT_SOURCE_COUNT = 2;

export type AlertEligibilityInput = {
  incidentType: string;
  priority: string;
  status: string;
  confidenceScore: number;
  sourceCount?: number;
  trustedSourceConfirmed?: boolean;
  adminVerified?: boolean;
  agencyVerified?: boolean;
  emergencyOverride?: boolean;
  hasVideoEvidence?: boolean;
};

export type AlertEligibilityResult = {
  eligible: boolean;
  reason: string;
  suggestedSeverity: "P1Immediate" | "P2Serious" | "P3Awareness";
  autoActivate: boolean;
};

export function isPublicAlertIncidentType(type: string) {
  return PUBLIC_ALERT_INCIDENT_TYPES.has(type);
}

export function defaultRadiiForIncident(type: string, priority: string) {
  if (type === IncidentType.Kidnapping || priority === IncidentPriority.P1LifeThreatening) {
    return { inner: 300, warning: 1000, outer: 2500 };
  }
  if (type === IncidentType.CommunitySafety) {
    return { inner: 500, warning: 2000, outer: 5000 };
  }
  if (type === IncidentType.Fire) {
    return { inner: 400, warning: 1500, outer: 3000 };
  }
  return { inner: 200, warning: 750, outer: 2000 };
}

export function evaluateAlertEligibility(input: AlertEligibilityInput): AlertEligibilityResult {
  if (!isPublicAlertIncidentType(input.incidentType)) {
    return { eligible: false, reason: "incident_type_not_public_alert", suggestedSeverity: "P3Awareness", autoActivate: false };
  }

  if (input.status === IncidentStatus.FalseReport || input.status === IncidentStatus.Closed) {
    return { eligible: false, reason: "incident_closed_or_false", suggestedSeverity: "P3Awareness", autoActivate: false };
  }

  const verified =
    input.adminVerified ||
    input.agencyVerified ||
    input.emergencyOverride ||
    input.confidenceScore >= AUTO_ALERT_CONFIDENCE_THRESHOLD ||
    (input.sourceCount ?? 0) >= MIN_INDEPENDENT_SOURCE_COUNT ||
    input.trustedSourceConfirmed ||
    input.hasVideoEvidence;

  if (!verified) {
    return { eligible: false, reason: "awaiting_verification", suggestedSeverity: "P3Awareness", autoActivate: false };
  }

  const suggestedSeverity =
    input.priority === IncidentPriority.P1LifeThreatening || input.emergencyOverride
      ? "P1Immediate"
      : input.priority === IncidentPriority.P2ActiveCrimeAccident
        ? "P2Serious"
        : "P3Awareness";

  return {
    eligible: true,
    reason: input.emergencyOverride ? "emergency_override" : "verification_threshold_met",
    suggestedSeverity,
    autoActivate: input.confidenceScore >= AUTO_ALERT_CONFIDENCE_THRESHOLD || Boolean(input.emergencyOverride),
  };
}
