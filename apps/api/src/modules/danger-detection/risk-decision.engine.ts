import { Injectable } from "@nestjs/common";
import type { DangerClassification, DangerDetectionState } from "@the-eye/shared";
import { haversineMeters } from "../verification/verification-signals";

export type CorrelationCandidate = {
  sourceId: string;
  latitude?: number;
  longitude?: number;
  incidentId?: string;
  semanticTags?: string[];
};

export type RiskDecision = {
  state: DangerDetectionState;
  resultingAction: "NONE" | "STANDARD_REVIEW" | "URGENT_REVIEW" | "POTENTIAL_EVENT_REVIEW";
  clusterKey?: string;
  correlatedSourceCount: number;
};

@Injectable()
export class RiskDecisionEngine {
  decide(input: {
    classification: DangerClassification;
    sourceId: string;
    incidentId?: string;
    latitude?: number;
    longitude?: number;
    candidates: CorrelationCandidate[];
    confidenceThreshold: number;
    correlationRadiusMeters: number;
    minimumCorrelatedSources: number;
  }): RiskDecision {
    const { classification } = input;
    if (classification.contextSuppression || !classification.immediateThreat || !classification.activeIncident) {
      return { state: "DETECTED", resultingAction: "NONE", correlatedSourceCount: 1 };
    }

    const hasLocation = input.latitude !== undefined && input.longitude !== undefined;
    if (!hasLocation) {
      return {
        state: classification.dangerLevel === "CRITICAL" || classification.dangerLevel === "HIGH" ? "VERIFYING" : "DETECTED",
        resultingAction: classification.dangerLevel === "CRITICAL" ? "URGENT_REVIEW" : "STANDARD_REVIEW",
        correlatedSourceCount: 1,
      };
    }

    const correlated = input.candidates.filter((candidate) => {
      if (candidate.sourceId === input.sourceId) return false;
      if (input.incidentId && candidate.incidentId === input.incidentId) return true;
      if (candidate.latitude === undefined || candidate.longitude === undefined) return false;
      return haversineMeters(input.latitude!, input.longitude!, candidate.latitude, candidate.longitude) <= input.correlationRadiusMeters;
    });
    const sourceCount = 1 + correlated.length;
    const clusterKey = `${classification.category}:${input.latitude!.toFixed(3)}:${input.longitude!.toFixed(3)}`;
    const confidencePass = classification.confidence >= input.confidenceThreshold;
    const corroborated = sourceCount >= input.minimumCorrelatedSources;

    if ((classification.dangerLevel === "HIGH" || classification.dangerLevel === "CRITICAL") && (confidencePass || corroborated)) {
      return {
        state: corroborated ? "VERIFYING" : "POTENTIAL",
        resultingAction: corroborated ? "URGENT_REVIEW" : "POTENTIAL_EVENT_REVIEW",
        clusterKey,
        correlatedSourceCount: sourceCount,
      };
    }
    return { state: "DETECTED", resultingAction: "STANDARD_REVIEW", clusterKey, correlatedSourceCount: sourceCount };
  }
}
