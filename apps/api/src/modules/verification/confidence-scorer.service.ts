import { Injectable } from "@nestjs/common";
import { IncidentPriority } from "@the-eye/shared";
import {
  DuplicateSignal,
  GpsValidationSignal,
  MediaEvidenceSignal,
  TrustedReporterSignal,
  scoreDuplicateSignal,
  scoreGpsValidation,
  scoreMediaEvidence,
  scoreTrustedReporter,
  verificationLatencyTargetMs,
} from "./verification-signals";
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
      shouldRequestCrowdConfirmation:
        confidenceScore < 80 && input.nearbyUserConfirmations < 2 && input.adminConfirmations === 0,
      shouldAutoEscalate: input.priority === IncidentPriority.P1LifeThreatening && confidenceScore >= 85,
      targetSystemVerificationMs: verificationLatencyTargetMs(),
      targetCrowdRequestMs: 10000,
      breakdown,
    };
  }

  breakdown(input: VerificationSignalInput): VerificationScoreBreakdown {
    const gps = input.gpsValidation ?? {
      hasIncidentGps: true,
      invalidCoordinates: false,
      mediaGpsAlignmentRatio: 0,
    };
    const media = input.mediaEvidence ?? { count: input.mediaEvidenceCount, gpsAlignedCount: 0, uniqueHashCount: 0, timelyCaptureCount: 0, typeVariety: 0, chainOfCustodyScore: 0, duplicateHashElsewhere: 0 };
    const duplicates = input.duplicateSignal ?? { count: input.duplicateReportsNearby, weightedScore: input.duplicateReportsNearby * 3, closestDistanceMeters: null };
    const trusted = input.trustedReporterSignal ?? {
      trustScore: input.reporterTrustScore,
      verificationLevel: null,
      verifiedRatio: 0.5,
      revoked: false,
    };

    return {
      gpsAccuracy: scoreGpsValidation(gps as GpsValidationSignal),
      reporterTrust: scoreTrustedReporter(trusted as TrustedReporterSignal),
      mediaEvidence: scoreMediaEvidence(media as MediaEvidenceSignal),
      liveVideo: input.hasLiveVideo ? 10 : 0,
      duplicateReportsNearby: scoreDuplicateSignal(duplicates as DuplicateSignal),
      timeConsistency: this.timeConsistencyScore(input.minutesSinceIncident),
      locationConsistency: this.locationConsistencyScore(input.locationConsistencyMeters),
      nearbyUserConfirmations: Math.min(input.nearbyUserConfirmations * 4, 12),
      trustedReporterConfirmation: Math.min(input.trustedReporterConfirmations * 8, 12),
      adminConfirmation: input.adminConfirmations > 0 ? 15 : 0,
      evidenceChainOfCustody: Math.min((media as MediaEvidenceSignal).chainOfCustodyScore ?? 0, 8),
      historicalFalseReportPenalty: -Math.min(input.historicalFalseReports * 6, 18),
    };
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
