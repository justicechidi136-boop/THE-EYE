import { Injectable } from "@nestjs/common";
import { IncidentPriority, IncidentType } from "@the-eye/shared";
import { incidentTypeAgencyTypes } from "./emergency-category";
import type { EmergencyIndicatorMetadata } from "./emergency-classification.service";

export type TriageInput = {
  incidentId: string;
  incidentType: IncidentType | string;
  priority?: IncidentPriority | string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  isTrustedReporter?: boolean;
  mediaCount?: number;
  duplicateReportCount?: number;
  indicators?: EmergencyIndicatorMetadata;
  dispatcherOverride?: {
    priority: IncidentPriority;
    responseUrgency?: TriageResult["responseUrgency"];
    suggestedAgencyTypes?: string[];
    escalationDeadlineSeconds?: number;
    overrideReason: string;
    actorId?: string;
  };
};

export type TriageResult = {
  priority: IncidentPriority;
  responseUrgency: "immediate" | "urgent" | "standard" | "monitor";
  suggestedAgencyTypes: string[];
  escalationDeadlineSeconds: number;
  rationale: string[];
  overridden: boolean;
  overrideReason?: string;
};

const PRIORITY_ORDER: IncidentPriority[] = [
  IncidentPriority.P4GeneralSafety,
  IncidentPriority.P3SuspiciousActivity,
  IncidentPriority.P2ActiveCrimeAccident,
  IncidentPriority.P1LifeThreatening,
];

@Injectable()
export class TriageService {
  evaluate(input: TriageInput): TriageResult {
    if (input.dispatcherOverride) {
      return {
        priority: input.dispatcherOverride.priority,
        responseUrgency: input.dispatcherOverride.responseUrgency ?? urgencyFromPriority(input.dispatcherOverride.priority),
        suggestedAgencyTypes: input.dispatcherOverride.suggestedAgencyTypes ?? incidentTypeAgencyTypes(input.incidentType as IncidentType),
        escalationDeadlineSeconds: input.dispatcherOverride.escalationDeadlineSeconds ?? deadlineFromPriority(input.dispatcherOverride.priority),
        rationale: [`Dispatcher override: ${input.dispatcherOverride.overrideReason}`],
        overridden: true,
        overrideReason: input.dispatcherOverride.overrideReason,
      };
    }

    const rationale: string[] = [];
    let priority = this.basePriority(input.incidentType as IncidentType, rationale);
    if (input.priority) {
      priority = maxPriority(priority, input.priority as IncidentPriority, rationale, "Existing incident priority preserved");
    }

    if (input.indicators?.medicalIndicators) {
      priority = bumpPriority(priority, rationale, "Medical indicators reported");
    }
    if (input.indicators?.weaponIndicators) {
      priority = bumpPriority(priority, rationale, "Weapon indicators reported");
    }
    if (input.indicators?.activeThreat) {
      priority = bumpPriority(priority, rationale, "Active threat reported");
    }
    if ((input.indicators?.injuryIndicators?.length ?? 0) > 0) {
      priority = bumpPriority(priority, rationale, "Injury indicators reported");
    }
    if ((input.mediaCount ?? 0) > 0) {
      rationale.push(`Evidence attached: ${input.mediaCount} media item(s)`);
    }
    if ((input.duplicateReportCount ?? 0) > 0) {
      priority = bumpPriority(priority, rationale, `${input.duplicateReportCount} corroborating report(s) nearby`);
    }
    if (input.isTrustedReporter) {
      rationale.push("Trusted reporter flag noted without reducing access");
    }
    if (input.accuracyMeters !== undefined && input.accuracyMeters !== null && input.accuracyMeters > 100) {
      rationale.push(`GPS accuracy low (${input.accuracyMeters}m)`);
    }

    const suggestedAgencyTypes = incidentTypeAgencyTypes(input.incidentType as IncidentType);
    rationale.push(`Suggested agency types: ${suggestedAgencyTypes.join(", ")}`);

    return {
      priority,
      responseUrgency: urgencyFromPriority(priority),
      suggestedAgencyTypes,
      escalationDeadlineSeconds: deadlineFromPriority(priority),
      rationale,
      overridden: false,
    };
  }

  private basePriority(type: IncidentType, rationale: string[]): IncidentPriority {
    switch (type) {
      case IncidentType.Emergency:
      case IncidentType.Fire:
      case IncidentType.Kidnapping:
      case IncidentType.Medical:
      case IncidentType.SOS:
        rationale.push(`Base priority P1 for ${type}`);
        return IncidentPriority.P1LifeThreatening;
      case IncidentType.Crime:
      case IncidentType.Accident:
      case IncidentType.Abuse:
        rationale.push(`Base priority P2 for ${type}`);
        return IncidentPriority.P2ActiveCrimeAccident;
      case IncidentType.SuspiciousActivity:
        rationale.push(`Base priority P3 for ${type}`);
        return IncidentPriority.P3SuspiciousActivity;
      default:
        rationale.push(`Base priority P4 for ${type}`);
        return IncidentPriority.P4GeneralSafety;
    }
  }
}

function bumpPriority(current: IncidentPriority, rationale: string[], reason: string): IncidentPriority {
  const index = PRIORITY_ORDER.indexOf(current);
  const next = PRIORITY_ORDER[Math.min(index + 1, PRIORITY_ORDER.length - 1)];
  rationale.push(`${reason}; priority raised to ${next}`);
  return next;
}

function maxPriority(current: IncidentPriority, incoming: IncidentPriority, rationale: string[], reason: string): IncidentPriority {
  const currentIndex = PRIORITY_ORDER.indexOf(current);
  const incomingIndex = PRIORITY_ORDER.indexOf(incoming);
  if (incomingIndex <= currentIndex) return current;
  rationale.push(`${reason}; priority raised to ${incoming}`);
  return incoming;
}

export function urgencyFromPriority(priority: IncidentPriority): TriageResult["responseUrgency"] {
  switch (priority) {
    case IncidentPriority.P1LifeThreatening:
      return "immediate";
    case IncidentPriority.P2ActiveCrimeAccident:
      return "urgent";
    case IncidentPriority.P3SuspiciousActivity:
      return "standard";
    default:
      return "monitor";
  }
}

export function deadlineFromPriority(priority: IncidentPriority): number {
  switch (priority) {
    case IncidentPriority.P1LifeThreatening:
      return 300;
    case IncidentPriority.P2ActiveCrimeAccident:
      return 900;
    case IncidentPriority.P3SuspiciousActivity:
      return 1800;
    default:
      return 3600;
  }
}
