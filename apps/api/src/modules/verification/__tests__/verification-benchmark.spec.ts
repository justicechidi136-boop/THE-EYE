import { IncidentPriority, IncidentStatus } from "@the-eye/shared";
import { ConfidenceScorerService } from "../confidence-scorer.service";

const scorer = new ConfidenceScorerService();

describe("verification latency benchmark", () => {
  it("scores verification decisions within 5ms per incident (p95)", () => {
    const samples: number[] = [];
    const context = {
      incidentId: "incident-benchmark",
      priority: IncidentPriority.P2ActiveCrimeAccident,
      status: IncidentStatus.Submitted,
      gpsAccuracyMeters: 18,
      reporterTrustScore: 82,
      mediaEvidenceCount: 2,
      hasLiveVideo: false,
      duplicateReportsNearby: 1,
      minutesSinceIncident: 6,
      locationConsistencyMeters: 22,
      nearbyUserConfirmations: 1,
      trustedReporterConfirmations: 0,
      adminConfirmations: 0,
      historicalFalseReports: 0,
      gpsValidation: {
        accuracyMeters: 18,
        hasIncidentGps: true,
        invalidCoordinates: false,
        manualAdjustmentMeters: 12,
        mediaGpsAlignmentRatio: 1,
      },
      mediaEvidence: {
        count: 2,
        gpsAlignedCount: 2,
        uniqueHashCount: 2,
        timelyCaptureCount: 2,
        typeVariety: 2,
        chainOfCustodyScore: 6,
        duplicateHashElsewhere: 0,
      },
      duplicateSignal: { count: 1, weightedScore: 4, closestDistanceMeters: 80 },
      trustedReporterSignal: {
        trustScore: 82,
        verificationLevel: "Verified",
        verifiedRatio: 0.8,
        revoked: false,
      },
    };

    for (let i = 0; i < 500; i += 1) {
      const startedAt = performance.now();
      scorer.score(context);
      samples.push(performance.now() - startedAt);
    }

    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95)] ?? 0;
    const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;

    expect(p95).toBeLessThan(5);
    expect(avg).toBeLessThan(2);
    expect(scorer.score(context).targetSystemVerificationMs).toBe(5000);
  });
});
