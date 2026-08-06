import { Injectable } from "@nestjs/common";
import { IncidentType } from "@the-eye/shared";
import { PrismaService } from "../prisma/prisma.service";
import { RESOLUTION_ELIGIBLE_INCIDENT_TYPES, ACTIVE_ASSIGNMENT_STATUSES } from "./community-verification.constants";

export interface CommunityVerificationScore {
  confirmedScore: number;
  notFoundScore: number;
  ongoingScore: number;
  resolvedScore: number;
  conflictScore: number;
  confidenceLevel: "High" | "Medium" | "Low" | "Insufficient";
  reviewRequired: boolean;
  recommendation:
    | "NONE"
    | "CONTINUE_VERIFICATION"
    | "COMMUNITY_RESOLUTION_RECOMMENDED"
    | "MANUAL_REVIEW_REQUIRED";
  safeSummaryText: string;
}

const RESPONSE_WEIGHTS: Record<string, number> = {
  Confirmed: 1,
  NotFound: 1,
  StillOngoing: 0.85,
  AppearsResolved: 0.85,
  UnsafeToVerify: 0.4,
  Skipped: 0,
  Unsure: 0.35,
};

@Injectable()
export class CommunityVerificationScoringService {
  constructor(private readonly prisma: PrismaService) {}

  async scoreIncident(incidentId: string): Promise<CommunityVerificationScore> {
    const [incident, responses, deviceDupes] = await Promise.all([
      this.prisma.incident.findUnique({
        where: { id: incidentId },
        select: {
          type: true,
          assignments: { where: { status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] as never[] } }, take: 1 },
        },
      }),
      this.prisma.communityVerificationResponse.findMany({
        where: { incidentId, flaggedSuspicious: false },
        include: {
          user: { select: { createdAt: true, trustedReporter: { select: { revokedAt: true } } } },
        },
      }),
      this.prisma.$queryRaw<Array<{ deviceId: string; count: bigint }>>`
        SELECT upt.device_id AS "deviceId", COUNT(*)::bigint AS count
          FROM community_verification_responses cvr
          JOIN user_push_tokens upt ON upt.user_id = cvr.user_id AND upt.device_id IS NOT NULL
         WHERE cvr.incident_id = ${incidentId}::uuid
         GROUP BY upt.device_id
        HAVING COUNT(*) > 1
      `,
    ]);

    const buckets = {
      Confirmed: 0,
      NotFound: 0,
      StillOngoing: 0,
      AppearsResolved: 0,
    };

    let weightedTotal = 0;
    for (const response of responses) {
      const base = RESPONSE_WEIGHTS[String(response.responseType)] ?? 0.2;
      const trustBoost = response.user.trustedReporter && !response.user.trustedReporter.revokedAt ? 1.15 : 1;
      const accountAgeDays = Math.max(1, (Date.now() - response.user.createdAt.getTime()) / 86_400_000);
      const ageFactor = Math.min(1.2, 0.8 + accountAgeDays / 365);
      const distanceFactor =
        response.approximateDistanceAtResponse != null && response.approximateDistanceAtResponse <= 250 ? 1.1 : 1;
      const weight = Number(response.trustWeight ?? 1) * base * trustBoost * ageFactor * distanceFactor;
      weightedTotal += weight;
      const type = String(response.responseType);
      if (type in buckets) buckets[type as keyof typeof buckets] += weight;
    }

    const duplicateDevicePenalty = deviceDupes.length * 0.15;
    const confirmedScore = buckets.Confirmed;
    const notFoundScore = buckets.NotFound;
    const ongoingScore = buckets.StillOngoing;
    const resolvedScore = buckets.AppearsResolved;
    const conflictScore = Math.min(confirmedScore, notFoundScore) + Math.min(ongoingScore, resolvedScore) + duplicateDevicePenalty;

    const independentCount = new Set(responses.map((r) => r.userId)).size;
    let confidenceLevel: CommunityVerificationScore["confidenceLevel"] = "Insufficient";
    if (independentCount >= 3 && weightedTotal >= 2.5 && conflictScore < 0.8) confidenceLevel = "High";
    else if (independentCount >= 2 && weightedTotal >= 1.5) confidenceLevel = "Medium";
    else if (independentCount >= 1) confidenceLevel = "Low";

    const incidentType = (incident?.type ?? "Emergency") as IncidentType;
    const respondersActive = Boolean(incident?.assignments.length);
    const resolutionEligible =
      RESOLUTION_ELIGIBLE_INCIDENT_TYPES.has(incidentType) && !respondersActive && conflictScore < 1;

    let recommendation: CommunityVerificationScore["recommendation"] = "NONE";
    if (conflictScore >= 1.2 || duplicateDevicePenalty >= 0.3) recommendation = "MANUAL_REVIEW_REQUIRED";
    else if (resolvedScore > ongoingScore + confirmedScore * 0.5 && resolutionEligible) {
      recommendation = "COMMUNITY_RESOLUTION_RECOMMENDED";
    } else if (confirmedScore + ongoingScore > notFoundScore + resolvedScore) {
      recommendation = "CONTINUE_VERIFICATION";
    } else if (independentCount < 2) recommendation = "CONTINUE_VERIFICATION";

    const safeSummaryText = this.buildSafeSummaryText({
      confirmedScore,
      notFoundScore,
      ongoingScore,
      resolvedScore,
      conflictScore,
    });

    return {
      confirmedScore,
      notFoundScore,
      ongoingScore,
      resolvedScore,
      conflictScore,
      confidenceLevel,
      reviewRequired: recommendation === "MANUAL_REVIEW_REQUIRED" || conflictScore >= 1,
      recommendation,
      safeSummaryText,
    };
  }

  computeTrustWeight(input: {
    accountAgeDays: number;
    trustedReporter: boolean;
    duplicateDevice: boolean;
    locationQuality?: string | null;
  }) {
    let weight = 1;
    if (input.trustedReporter) weight *= 1.15;
    if (input.accountAgeDays < 7) weight *= 0.7;
    if (input.duplicateDevice) weight *= 0.35;
    if (input.locationQuality === "Poor") weight *= 0.75;
    return Math.max(0.1, Math.min(1.5, weight));
  }

  private buildSafeSummaryText(input: {
    confirmedScore: number;
    notFoundScore: number;
    ongoingScore: number;
    resolvedScore: number;
    conflictScore: number;
  }) {
    if (input.conflictScore >= 1) {
      return "Community responses are mixed. Verification is continuing.";
    }
    if (input.resolvedScore > input.ongoingScore && input.resolvedScore > input.confirmedScore) {
      return "Community reports indicate that the incident may no longer be active.";
    }
    if (input.notFoundScore > input.confirmedScore + input.ongoingScore) {
      return "Nearby users have not been able to confirm this incident.";
    }
    if (input.confirmedScore + input.ongoingScore > 0) {
      return "Nearby users continue to confirm that the incident is ongoing.";
    }
    return "Community verification is in progress.";
  }
}
