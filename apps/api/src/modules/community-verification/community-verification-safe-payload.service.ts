import { Injectable } from "@nestjs/common";
import { IncidentType } from "@the-eye/shared";
import {
  ALL_RESPONSE_TYPES,
  COMMUNITY_VERIFICATION_SAFE_PAYLOAD_VERSION,
  INCIDENT_TYPE_DISPLAY,
  PASSIVE_ALLOWED_RESPONSES,
  PASSIVE_SAFETY_NOTICE,
  PASSIVE_ONLY_INCIDENT_TYPES,
  SAFETY_WARNING,
  approximateDistanceLabel,
  buildApproximateArea,
  buildSpokenSummaryTemplate,
  sanitizePublicDescription,
} from "./community-verification.constants";

@Injectable()
export class CommunityVerificationSafePayloadService {
  buildSafePayload(input: {
    requestId: string;
    incidentType: string;
    country: string;
    state: string;
    lga: string;
    submittedAt: Date;
    description: string | null;
    approximateDistanceMeters: number | null;
    distanceBand: string | null;
    expiresAt: Date;
    passiveOnly: boolean;
    alreadyResponded: boolean;
    isExpired: boolean;
    evidencePreviews: Array<{ id: string; mediaType: string; previewUrl?: string | null }>;
  }) {
    const categoryDisplayLabel = INCIDENT_TYPE_DISPLAY[input.incidentType] ?? input.incidentType;
    const approximateArea = buildApproximateArea(input.country, input.state, input.lga);
    const approximateDistance = approximateDistanceLabel(input.approximateDistanceMeters);
    const reportTime = input.submittedAt.toISOString();
    return {
      requestId: input.requestId,
      category: input.incidentType,
      categoryDisplayLabel,
      approximateArea,
      approximateDistance,
      distanceBand: input.distanceBand,
      reportTime,
      sanitizedDescription: sanitizePublicDescription(input.description, input.incidentType),
      approvedEvidencePreviews: input.evidencePreviews,
      safetyNotice: input.passiveOnly ? PASSIVE_SAFETY_NOTICE : SAFETY_WARNING,
      allowedResponses: input.passiveOnly ? [...PASSIVE_ALLOWED_RESPONSES] : [...ALL_RESPONSE_TYPES],
      spokenSummaryTemplate: buildSpokenSummaryTemplate({
        categoryDisplayLabel,
        approximateArea,
        approximateDistance,
        reportTime,
      }),
      expiry: input.expiresAt.toISOString(),
      alreadyResponded: input.alreadyResponded,
      isExpired: input.isExpired,
      safePayloadVersion: COMMUNITY_VERIFICATION_SAFE_PAYLOAD_VERSION,
    };
  }

  isPassiveOnly(incidentType: string, respondersActive: boolean) {
    return PASSIVE_ONLY_INCIDENT_TYPES.has(incidentType as IncidentType) || respondersActive;
  }
}
