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
    });

    expect(result.confidenceScore).toBeGreaterThanOrEqual(85);
    expect(result.status).toBe("HighConfidence");
    expect(result.shouldAutoEscalate).toBe(true);
    expect(result.shouldRequestCrowdConfirmation).toBe(false);
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
    });

    expect(result.confidenceScore).toBeLessThan(80);
    expect(result.shouldRequestCrowdConfirmation).toBe(true);
    expect(result.shouldAutoEscalate).toBe(false);
  });

  it("penalizes historical false report behavior", () => {
    const clean = scorer.score({
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
      historicalFalseReports: 0,
    });

    const risky = scorer.score({
      incidentId: "incident-4",
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
      historicalFalseReports: 3,
    });

    expect(risky.confidenceScore).toBeLessThan(clean.confidenceScore);
  });
});
