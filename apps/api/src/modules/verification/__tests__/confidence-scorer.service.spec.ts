import { IncidentPriority, IncidentStatus } from "@the-eye/shared";
import { ConfidenceScorerService } from "../confidence-scorer.service";

const scorer = new ConfidenceScorerService();

describe("ConfidenceScorerService", () => {
  it("scores high-confidence P1 incidents for immediate escalation", () => {
    const result = scorer.score({
      incidentId: "incident-1",
      priority: IncidentPriority.P1LifeThreatening,
      status: IncidentStatus.Submitted,
      gpsAccuracyMeters: 10,
      reporterTrustScore: 95,
      mediaEvidenceCount: 3,
      hasLiveVideo: true,
      duplicateReportsNearby: 3,
      minutesSinceIncident: 2,
      locationConsistencyMeters: 10,
      nearbyUserConfirmations: 2,
      trustedReporterConfirmations: 1,
      adminConfirmations: 1,
      historicalFalseReports: 0,
      gpsValidation: {
        accuracyMeters: 10,
        hasIncidentGps: true,
        invalidCoordinates: false,
        manualAdjustmentMeters: 8,
        mediaGpsAlignmentRatio: 1,
      },
      mediaEvidence: {
        count: 3,
        gpsAlignedCount: 3,
        uniqueHashCount: 3,
        timelyCaptureCount: 3,
        typeVariety: 2,
        chainOfCustodyScore: 7,
        duplicateHashElsewhere: 0,
      },
      duplicateSignal: { count: 3, weightedScore: 11, closestDistanceMeters: 35 },
      trustedReporterSignal: {
        trustScore: 95,
        verificationLevel: "Premium",
        verifiedRatio: 0.9,
        revoked: false,
      },
    });

    expect(result.confidenceScore).toBeGreaterThanOrEqual(85);
    expect(result.status).toBe("HighConfidence");
    expect(result.shouldAutoEscalate).toBe(true);
    expect(result.shouldRequestCrowdConfirmation).toBe(false);
    expect(result.breakdown.evidenceChainOfCustody).toBeGreaterThan(0);
  });

  it("requests crowd confirmation for uncertain incidents", () => {
    const result = scorer.score({
      incidentId: "incident-2",
      priority: IncidentPriority.P3SuspiciousActivity,
      status: IncidentStatus.Submitted,
      gpsAccuracyMeters: 120,
      reporterTrustScore: 35,
      mediaEvidenceCount: 0,
      hasLiveVideo: false,
      duplicateReportsNearby: 0,
      minutesSinceIncident: 40,
      locationConsistencyMeters: 250,
      nearbyUserConfirmations: 0,
      trustedReporterConfirmations: 0,
      adminConfirmations: 0,
      historicalFalseReports: 1,
      gpsValidation: {
        accuracyMeters: 120,
        hasIncidentGps: true,
        invalidCoordinates: false,
        mediaGpsAlignmentRatio: 0,
      },
      mediaEvidence: {
        count: 0,
        gpsAlignedCount: 0,
        uniqueHashCount: 0,
        timelyCaptureCount: 0,
        typeVariety: 0,
        chainOfCustodyScore: 0,
        duplicateHashElsewhere: 0,
      },
      duplicateSignal: { count: 0, weightedScore: 0, closestDistanceMeters: null },
      trustedReporterSignal: { trustScore: 35, verificationLevel: null, verifiedRatio: 0.2, revoked: false },
    });

    expect(result.confidenceScore).toBeLessThan(80);
    expect(result.shouldRequestCrowdConfirmation).toBe(true);
    expect(result.shouldAutoEscalate).toBe(false);
  });

  it("penalizes historical false report behavior", () => {
    const base = {
      incidentId: "incident-3",
      priority: IncidentPriority.P2ActiveCrimeAccident,
      status: IncidentStatus.Submitted,
      gpsAccuracyMeters: 20,
      reporterTrustScore: 80,
      mediaEvidenceCount: 2,
      hasLiveVideo: false,
      duplicateReportsNearby: 1,
      minutesSinceIncident: 8,
      locationConsistencyMeters: 30,
      nearbyUserConfirmations: 1,
      trustedReporterConfirmations: 0,
      adminConfirmations: 0,
      gpsValidation: {
        accuracyMeters: 20,
        hasIncidentGps: true,
        invalidCoordinates: false,
        mediaGpsAlignmentRatio: 0.5,
      },
      mediaEvidence: {
        count: 2,
        gpsAlignedCount: 1,
        uniqueHashCount: 2,
        timelyCaptureCount: 2,
        typeVariety: 1,
        chainOfCustodyScore: 4,
        duplicateHashElsewhere: 0,
      },
      duplicateSignal: { count: 1, weightedScore: 3, closestDistanceMeters: 120 },
      trustedReporterSignal: { trustScore: 80, verificationLevel: "Verified", verifiedRatio: 0.7, revoked: false },
    };

    const clean = scorer.score({ ...base, incidentId: "incident-3", historicalFalseReports: 0 });
    const risky = scorer.score({ ...base, incidentId: "incident-4", historicalFalseReports: 3 });

    expect(risky.confidenceScore).toBeLessThan(clean.confidenceScore);
  });
});
