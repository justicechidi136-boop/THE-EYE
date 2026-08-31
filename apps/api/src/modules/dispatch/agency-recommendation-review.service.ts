import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { AdminRoleName } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { IncidentsService } from "../incidents/incidents.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  AGENCY_RECOMMENDATION_REVIEW_OUTCOMES,
  type AgencyRecommendationQualityReportQueryDto,
  type CreateAgencyRecommendationReviewDto,
} from "./dto/agency-recommendation-review.dto";
import {
  AGENCY_RECOMMENDATION_RULE_VERSION,
  AgencyRoutingService,
  type AdvisoryAgencyRecommendation,
} from "./agency-routing.service";

type StoredReview = Record<string, any>;

@Injectable()
export class AgencyRecommendationReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly incidents: IncidentsService,
    private readonly routing: AgencyRoutingService,
    private readonly audit: AuditService,
  ) {}

  async attachLatestReviews(incidentId: string, preview: Record<string, any>, actor: JwtPayload) {
    this.assertAdmin(actor);
    const reviews = await this.prisma.agencyRecommendationReview.findMany({
      where: { incidentId },
      orderBy: [{ reviewedAt: "desc" }, { id: "desc" }],
    });
    const latest = new Map<string, StoredReview>();
    for (const review of reviews as StoredReview[]) {
      if (!latest.has(review.recommendationKey)) latest.set(review.recommendationKey, review);
    }
    const attach = (recommendation: AdvisoryAgencyRecommendation) => ({
      ...recommendation,
      review: this.presentReview(latest.get(this.recommendationKey(recommendation)) ?? null),
    });
    return {
      ...preview,
      actionableRecommendations: preview.actionableRecommendations.map(attach),
      structuralMatches: preview.structuralMatches.map(attach),
      informationalMatches: preview.informationalMatches.map(attach),
    };
  }

  async createReview(
    incidentId: string,
    dto: CreateAgencyRecommendationReviewDto,
    actor: JwtPayload,
  ) {
    this.assertAdmin(actor);
    const incident = await this.incidents.get(incidentId, actor);
    const preview = await this.routing.previewIncident(incident, actor);
    if (preview.ruleVersion !== AGENCY_RECOMMENDATION_RULE_VERSION) {
      throw new BadRequestException("Unsupported recommendation rule version");
    }
    const recommendation = [
      ...preview.actionableRecommendations,
      ...preview.structuralMatches,
      ...preview.informationalMatches,
    ].find((candidate) => (
      candidate.agencyId === dto.agencyId
      && candidate.endpointType === dto.endpointType
      && (candidate.officeId ?? null) === (dto.endpointId ?? null)
    ));
    if (!recommendation) throw new BadRequestException("Recommendation is no longer available for review");

    const recommendationKey = this.recommendationKey(recommendation);
    const previous = await this.prisma.agencyRecommendationReview.findFirst({
      where: { incidentId, recommendationKey },
      orderBy: [{ reviewedAt: "desc" }, { id: "desc" }],
    });
    const note = this.sanitizeNote(dto.note);
    const reviewedAt = new Date();
    const geography = preview.input.geography;
    if (!geography.stateId || !geography.stateName) {
      throw new BadRequestException("Recommendation review requires a canonical State/FCT");
    }
    const review = await this.prisma.agencyRecommendationReview.create({
      data: {
        incidentId,
        agencyId: recommendation.agencyId,
        stateId: geography.stateId,
        reviewerAdminId: actor.sub,
        previousReviewId: previous?.id,
        recommendationKey,
        recommendationRuleVersion: preview.ruleVersion,
        agencyName: recommendation.agencyName,
        endpointId: recommendation.officeId,
        endpointType: recommendation.endpointType,
        endpointName: recommendation.officeName,
        recommendationTier: recommendation.tier,
        matchedCapability: recommendation.capability,
        jurisdictionLevel: recommendation.jurisdictionLevel,
        operationalReady: recommendation.operationalReady,
        verificationState: recommendation.verificationStatus,
        qualifiedDistanceMeters: recommendation.distanceMeters,
        reasons: recommendation.reasons,
        limitations: recommendation.limitations,
        countryName: geography.countryName,
        stateName: geography.stateName,
        incidentType: preview.input.incidentType as never,
        outcome: dto.outcome as never,
        note,
        reviewedAt,
      },
    });
    await this.audit.record({
      actor,
      action: previous ? "agency_recommendation.review_revised" : "agency_recommendation.review_created",
      entityType: "agency_recommendation_reviews",
      entityId: review.id,
      reason: note ?? undefined,
      beforeState: previous ? { outcome: previous.outcome, note: previous.note } : undefined,
      afterState: { outcome: review.outcome, note: review.note, ruleVersion: review.recommendationRuleVersion },
      metadata: {
        incidentId,
        agencyId: review.agencyId,
        endpointId: review.endpointId,
        recommendationTier: review.recommendationTier,
      },
    });
    return this.presentReview(review as StoredReview);
  }

  async qualityReport(actor: JwtPayload, query: AgencyRecommendationQualityReportQueryDto) {
    this.assertAdmin(actor);
    const where = {
      ...this.reviewScopeWhere(actor),
      ...(query.ruleVersion ? { recommendationRuleVersion: query.ruleVersion } : {}),
      ...(query.stateId ? { stateId: query.stateId } : {}),
      ...(query.incidentType ? { incidentType: query.incidentType as never } : {}),
      ...(query.agencyId ? { agencyId: query.agencyId } : {}),
      ...(query.tier ? { recommendationTier: query.tier } : {}),
      ...(query.outcome ? { outcome: query.outcome as never } : {}),
      ...(query.reviewedFrom || query.reviewedTo ? {
        reviewedAt: {
          ...(query.reviewedFrom ? { gte: new Date(query.reviewedFrom) } : {}),
          ...(query.reviewedTo ? { lte: new Date(query.reviewedTo) } : {}),
        },
      } : {}),
    };
    const [totalReviewed, grouped, reviews, optionRows] = await Promise.all([
      this.prisma.agencyRecommendationReview.count({ where }),
      this.prisma.agencyRecommendationReview.groupBy({ by: ["outcome"], where, _count: { _all: true } }),
      this.prisma.agencyRecommendationReview.findMany({
        where,
        orderBy: [{ reviewedAt: "desc" }, { id: "desc" }],
        take: query.limit ?? 100,
      }),
      this.prisma.agencyRecommendationReview.findMany({
        where: this.reviewScopeWhere(actor),
        select: {
          stateId: true,
          stateName: true,
          agencyId: true,
          agencyName: true,
        },
        distinct: ["stateId", "agencyId"],
      }),
    ]);
    const counts = Object.fromEntries(AGENCY_RECOMMENDATION_REVIEW_OUTCOMES.map((outcome) => [outcome, 0]));
    for (const row of grouped as Array<Record<string, any>>) counts[String(row.outcome)] = Number(row._count._all);
    const accepted = counts.ACCEPTED_AS_RELEVANT;
    const states = Array.from(new Map((optionRows as StoredReview[])
      .map((row) => [row.stateId, { id: row.stateId, name: row.stateName }])).values())
      .sort((left, right) => left.name.localeCompare(right.name));
    const agencies = Array.from(new Map((optionRows as StoredReview[])
      .map((row) => [row.agencyId, { id: row.agencyId, name: row.agencyName }])).values())
      .sort((left, right) => left.name.localeCompare(right.name));
    const findings = (reviews as StoredReview[])
      .filter((review) => ["INSUFFICIENT_OPERATIONAL_DATA", "OUTDATED_DIRECTORY_DATA"].includes(review.outcome))
      .map((review) => ({
        reviewId: review.id,
        agencyId: review.agencyId,
        agencyName: review.agencyName,
        endpointId: review.endpointId,
        stateName: review.stateName,
        findingType: review.outcome,
        note: review.note,
        reviewedAt: review.reviewedAt,
        humanReviewRequired: true,
        automaticDirectoryChange: false,
      }));
    return {
      summary: {
        totalReviewed,
        ...counts,
        acceptanceRate: totalReviewed === 0 ? null : accepted / totalReviewed,
        acceptanceRateDefinition: "ACCEPTED_AS_RELEVANT / TOTAL REVIEWED",
      },
      reviews: (reviews as StoredReview[]).map((review) => this.presentReview(review)),
      dataQualityFindings: findings,
      filters: { states, agencies },
      meta: {
        automaticDirectoryChanges: 0,
        automaticRoutingChanges: 0,
        externalCommunicationCalls: 0,
        incidentStateMutations: 0,
      },
    };
  }

  private recommendationKey(recommendation: Pick<AdvisoryAgencyRecommendation, "agencyId" | "endpointType" | "officeId">) {
    return `${recommendation.agencyId}:${recommendation.endpointType}:${recommendation.officeId ?? "structural"}`;
  }

  private sanitizeNote(note?: string) {
    if (!note) return null;
    const sanitized = note.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
    return sanitized || null;
  }

  private presentReview(review: StoredReview | null) {
    if (!review) return null;
    return {
      id: review.id,
      outcome: review.outcome,
      note: review.note ?? null,
      reviewerAdminId: review.reviewerAdminId,
      reviewedAt: review.reviewedAt instanceof Date ? review.reviewedAt.toISOString() : review.reviewedAt,
      recommendationRuleVersion: review.recommendationRuleVersion,
      previousReviewId: review.previousReviewId ?? null,
      agencyId: review.agencyId,
      agencyName: review.agencyName,
      endpointId: review.endpointId ?? null,
      endpointType: review.endpointType,
      endpointName: review.endpointName ?? null,
      recommendationTier: review.recommendationTier,
      matchedCapability: review.matchedCapability,
      jurisdictionLevel: review.jurisdictionLevel,
      operationalReady: review.operationalReady,
      verificationState: review.verificationState,
      qualifiedDistanceMeters: review.qualifiedDistanceMeters ?? null,
      reasons: review.reasons,
      limitations: review.limitations,
      countryName: review.countryName,
      stateName: review.stateName,
      incidentType: review.incidentType,
    };
  }

  private reviewScopeWhere(actor: JwtPayload) {
    if (actor.role === AdminRoleName.SuperAdmin) return {};
    if (actor.role === AdminRoleName.CountryAdmin) return actor.country ? { countryName: actor.country } : { id: "__none__" };
    return actor.country && actor.state
      ? { countryName: actor.country, stateName: actor.state }
      : { id: "__none__" };
  }

  private assertAdmin(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Admin access required");
  }
}
