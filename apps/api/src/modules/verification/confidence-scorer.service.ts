import { Injectable } from "@nestjs/common";
import { IncidentPriority } from "@the-eye/shared";
import { IncidentVerificationContext, VerificationDecision, VerificationSignalInput, VerificationScoreBreakdown } from "./verification.types";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

@Injectable()
export class ConfidenceScorerService {
  score(input: IncidentVerificationContext): VerificationDecision {
    const breakdown = this.breakdown(input);
    const rawScore = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
    const confidenceScore = Math.round(clamp(rawScore));
    const status = this.statusFor(confidenceScore);

    return {
      confidenceScore,
      status,
      shouldRequestCrowdConfirmation: confidenceScore < 80 && input.nearbyUserConfirmations < 2 && input.adminConfirmations === 0,
      shouldAutoEscalate: input.priority === IncidentPriority.P1LifeThreatening && confidenceScore >= 85,
      targetSystemVerificationMs: 5000,
      targetCrowdRequestMs: 10000,
      breakdown,
    };
  }

  breakdown(input: VerificationSignalInput): VerificationScoreBreakdown {
    return {
      gpsAccuracy: this.gpsAccuracyScore(input.gpsAccuracyMeters),
      reporterTrust: this.reporterTrustScore(input.reporterTrustScore),
      mediaEvidence: this.mediaEvidenceScore(input.mediaEvidenceCount),
      liveVideo: input.hasLiveVideo ? 10 : 0,
      duplicateReportsNearby: this.duplicateScore(input.duplicateReportsNearby),
      timeConsistency: this.timeConsistencyScore(input.minutesSinceIncident),
      locationConsistency: this.locationConsistencyScore(input.locationConsistencyMeters),
      nearbyUserConfirmations: Math.min(input.nearbyUserConfirmations * 4, 12),
      trustedReporterConfirmation: Math.min(input.trustedReporterConfirmations * 8, 12),
      adminConfirmation: input.adminConfirmations > 0 ? 15 : 0,
      historicalFalseReportPenalty: -Math.min(input.historicalFalseReports * 6, 18),
    };
  }

  private gpsAccuracyScore(accuracy?: number | null) {
    if (accuracy === undefined || accuracy === null) return 4;
    if (accuracy <= 15) return 12;
    if (accuracy <= 50) return 9;
    if (accuracy <= 100) return 6;
    if (accuracy <= 250) return 3;
    return 0;
  }

  private reporterTrustScore(score?: number | null) {
    if (score === undefined || score === null) return 5;
    return clamp((score / 100) * 14, 0, 14);
  }

  private mediaEvidenceScore(count: number) {
    if (count <= 0) return 0;
    if (count === 1) return 7;
    if (count === 2) return 10;
    return 12;
  }

  private duplicateScore(count: number) {
    if (count <= 0) return 0;
    if (count === 1) return 5;
    if (count === 2) return 8;
    return 10;
  }

  private timeConsistencyScore(minutes?: number | null) {
    if (minutes === undefined || minutes === null) return 5;
    if (minutes <= 10) return 8;
    if (minutes <= 60) return 6;
    if (minutes <= 24 * 60) return 3;
    return 0;
  }

  private locationConsistencyScore(distanceMeters?: number | null) {
    if (distanceMeters === undefined || distanceMeters === null) return 5;
    if (distanceMeters <= 25) return 9;
    if (distanceMeters <= 100) return 7;
    if (distanceMeters <= 500) return 3;
    return 0;
  }

  private statusFor(score: number): VerificationDecision["status"] {
    if (score >= 85) return "HighConfidence";
    if (score >= 70) return "LikelyValid";
    if (score >= 45) return "NeedsCrowdConfirmation";
    return "LowConfidence";
  }
}
