import { IncidentPriority, IncidentStatus } from "@the-eye/shared";
import type {
  DuplicateSignal,
  GpsValidationSignal,
  MediaEvidenceSignal,
  TrustedReporterSignal,
} from "./verification-signals";

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
  gpsValidation?: GpsValidationSignal;
  mediaEvidence?: MediaEvidenceSignal;
  duplicateSignal?: DuplicateSignal;
  trustedReporterSignal?: TrustedReporterSignal;
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
  evidenceChainOfCustody: number;
  historicalFalseReportPenalty: number;
};

export type VerificationDecision = {
  confidenceScore: number;
  status: "LowConfidence" | "NeedsCrowdConfirmation" | "LikelyValid" | "HighConfidence";
  shouldRequestCrowdConfirmation: boolean;
  shouldAutoEscalate: boolean;
  targetSystemVerificationMs: number;
  targetCrowdRequestMs: number;
  withinTarget?: boolean;
  breakdown: VerificationScoreBreakdown;
};

export type IncidentVerificationContext = VerificationSignalInput & {
  incidentId: string;
  priority: IncidentPriority;
  status: IncidentStatus;
};
