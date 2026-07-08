import { IncidentPriority, IncidentStatus } from "@the-eye/shared";

export type VerificationSignalInput = {
  gpsAccuracyMeters?: number | null;
  reporterTrustScore?: number | null;
  mediaEvidenceCount: number;
  hasLiveVideo: boolean;
  duplicateReportsNearby: number;
  minutesSinceIncident?: number | null;
  locationConsistencyMeters?: number | null;
  nearbyUserConfirmations: number;
  trustedReporterConfirmations: number;
  adminConfirmations: number;
  historicalFalseReports: number;
};

export type VerificationScoreBreakdown = {
  gpsAccuracy: number;
  reporterTrust: number;
  mediaEvidence: number;
  liveVideo: number;
  duplicateReportsNearby: number;
  timeConsistency: number;
  locationConsistency: number;
  nearbyUserConfirmations: number;
  trustedReporterConfirmation: number;
  adminConfirmation: number;
  historicalFalseReportPenalty: number;
};

export type VerificationDecision = {
  confidenceScore: number;
  status: "LowConfidence" | "NeedsCrowdConfirmation" | "LikelyValid" | "HighConfidence";
  shouldRequestCrowdConfirmation: boolean;
  shouldAutoEscalate: boolean;
  targetSystemVerificationMs: number;
  targetCrowdRequestMs: number;
  breakdown: VerificationScoreBreakdown;
};

export type IncidentVerificationContext = VerificationSignalInput & {
  incidentId: string;
  priority: IncidentPriority;
  status: IncidentStatus;
};
