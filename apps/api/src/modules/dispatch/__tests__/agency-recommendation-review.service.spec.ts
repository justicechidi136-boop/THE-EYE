import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AdminRoleName } from "@the-eye/shared";
import { validateSync } from "class-validator";
import type { JwtPayload } from "../../../common/auth/jwt";
import { AgencyRecommendationReviewService } from "../agency-recommendation-review.service";
import {
  AgencyRecommendationQualityReportQueryDto,
  CreateAgencyRecommendationReviewDto,
} from "../dto/agency-recommendation-review.dto";

const actor: JwtPayload = {
  sub: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  typ: "admin",
  role: AdminRoleName.StateAdmin,
  country: "Nigeria",
  state: "Lagos",
  permissions: ["incident:read"],
};

const incident = {
  id: "11111111-1111-1111-1111-111111111111",
  type: "Fire",
  priority: "P1LifeThreatening",
  country: "Nigeria",
  state: "Lagos",
  lga: "Ikeja",
};

const actionable = {
  agencyId: "22222222-2222-2222-2222-222222222222",
  agencyName: "Lagos State Emergency Management Agency",
  officeId: "33333333-3333-3333-3333-333333333333",
  officeName: "Lagos Command",
  endpointType: "AGENCY_OFFICE",
  tier: "PRIMARY",
  capability: "Fire",
  jurisdictionLevel: "STATE",
  verificationStatus: "VERIFIED",
  operationalReady: true,
  coordinateQualified: true,
  coordinates: { latitude: 6.6, longitude: 3.35 },
  distanceMeters: 850,
  publicAddress: "Alausa, Ikeja",
  publicContacts: [],
  reasons: ["Verified fire capability."],
  limitations: [],
};

const structural = {
  ...actionable,
  officeId: null,
  officeName: null,
  endpointType: "STRUCTURAL_AGENCY",
  tier: "STRUCTURAL_ONLY",
  operationalReady: false,
  coordinateQualified: false,
  coordinates: null,
  distanceMeters: null,
  reasons: ["Verified structural capability."],
  limitations: ["No verified operational endpoint"],
};

function preview(recommendation = actionable) {
  return {
    ruleVersion: "agency-recommendation-v1",
    input: {
      incidentType: "Fire",
      geography: {
        countryId: "44444444-4444-4444-4444-444444444444",
        countryName: "Nigeria",
        stateId: "55555555-5555-5555-5555-555555555555",
        stateName: "Lagos",
        lgaId: "66666666-6666-6666-6666-666666666666",
        lgaName: "Ikeja",
      },
    },
    actionableRecommendations: recommendation.tier === "PRIMARY" ? [recommendation] : [],
    structuralMatches: recommendation.tier === "STRUCTURAL_ONLY" ? [recommendation] : [],
    informationalMatches: [],
  };
}

function buildService(options: { recommendation?: typeof actionable; previous?: Record<string, unknown> | null } = {}) {
  const recommendation = options.recommendation ?? actionable;
  const previous = options.previous ?? null;
  const created = {
    id: "77777777-7777-7777-7777-777777777777",
    incidentId: incident.id,
    agencyId: recommendation.agencyId,
    stateId: "55555555-5555-5555-5555-555555555555",
    reviewerAdminId: actor.sub,
    previousReviewId: previous?.id ?? null,
    recommendationKey: `${recommendation.agencyId}:${recommendation.endpointType}:${recommendation.officeId ?? "structural"}`,
    recommendationRuleVersion: "agency-recommendation-v1",
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
    countryName: "Nigeria",
    stateName: "Lagos",
    incidentType: "Fire",
    outcome: "ACCEPTED_AS_RELEVANT",
    note: "Correct agency.",
    reviewedAt: new Date("2026-08-31T15:00:00.000Z"),
  };
  const prisma = {
    agencyRecommendationReview: {
      findFirst: jest.fn().mockResolvedValue(previous),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...created, ...data })),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    administrativeState: { findMany: jest.fn().mockResolvedValue([]) },
    agency: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    agencyJurisdiction: { update: jest.fn() },
    agencyIncidentCapability: { update: jest.fn() },
    incident: { update: jest.fn() },
    dispatchEvent: { create: jest.fn() },
    notification: { create: jest.fn() },
  };
  const incidents = { get: jest.fn().mockResolvedValue(incident) };
  const routing = { previewIncident: jest.fn().mockResolvedValue(preview(recommendation)) };
  const audit = { record: jest.fn().mockResolvedValue({ id: "audit-1" }) };
  const service = new AgencyRecommendationReviewService(prisma as never, incidents as never, routing as never, audit as never);
  return { service, prisma, incidents, routing, audit };
}

function dto(recommendation = actionable, outcome = "ACCEPTED_AS_RELEVANT") {
  return {
    agencyId: recommendation.agencyId,
    endpointId: recommendation.officeId ?? undefined,
    endpointType: recommendation.endpointType,
    outcome,
    note: "  Correct\u0000 agency.  ",
  };
}

describe("AgencyRecommendationReviewService", () => {
  it("persists an authorized actionable snapshot and fixed rule version", async () => {
    const { service, prisma, audit } = buildService();
    const result = await service.createReview(incident.id, dto() as never, actor);

    expect(result.recommendationRuleVersion).toBe("agency-recommendation-v1");
    expect(result.recommendationTier).toBe("PRIMARY");
    expect(result.qualifiedDistanceMeters).toBe(850);
    expect(result.reviewerAdminId).toBe(actor.sub);
    const persistedReviewedAt = prisma.agencyRecommendationReview.create.mock.calls[0][0].data.reviewedAt;
    expect(persistedReviewedAt).toBeInstanceOf(Date);
    expect(result.reviewedAt).toBe(persistedReviewedAt.toISOString());
    expect(prisma.agencyRecommendationReview.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        recommendationRuleVersion: "agency-recommendation-v1",
        reasons: actionable.reasons,
        limitations: actionable.limitations,
        note: "Correct agency.",
        reviewedAt: expect.any(Date),
      }),
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: "agency_recommendation.review_created",
      afterState: expect.objectContaining({ outcome: "ACCEPTED_AS_RELEVANT" }),
    }));
  });

  it("supports structural-only review without assuming the outcome", async () => {
    const { service, prisma } = buildService({ recommendation: structural as typeof actionable });
    await service.createReview(incident.id, dto(structural as typeof actionable, "INSUFFICIENT_OPERATIONAL_DATA") as never, actor);
    expect(prisma.agencyRecommendationReview.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        recommendationTier: "STRUCTURAL_ONLY",
        operationalReady: false,
        outcome: "INSUFFICIENT_OPERATIONAL_DATA",
      }),
    }));
  });

  it("appends revisions and audits previous and new outcomes", async () => {
    const previous = { id: "88888888-8888-8888-8888-888888888888", outcome: "NOT_RELEVANT", note: "Old note" };
    const { service, prisma, audit } = buildService({ previous });
    await service.createReview(incident.id, dto() as never, actor);
    expect(prisma.agencyRecommendationReview.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ previousReviewId: previous.id }),
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: "agency_recommendation.review_revised",
      beforeState: { outcome: "NOT_RELEVANT", note: "Old note" },
    }));
  });

  it("denies non-admin and cross-State review before routing", async () => {
    const { service, incidents, routing } = buildService();
    await expect(service.createReview(incident.id, dto() as never, { ...actor, typ: "user" }))
      .rejects.toBeInstanceOf(ForbiddenException);
    incidents.get.mockRejectedValueOnce(new NotFoundException("outside scope"));
    await expect(service.createReview(incident.id, dto() as never, actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(routing.previewIncident.mock.calls.length).toBe(0);
  });

  it("rejects a recommendation selector not produced by the backend", async () => {
    const { service } = buildService();
    await expect(service.createReview(incident.id, { ...dto(), agencyId: "99999999-9999-9999-9999-999999999999" } as never, actor))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("validates outcomes and bounded notes", () => {
    const invalidOutcome = Object.assign(new CreateAgencyRecommendationReviewDto(), dto(), { outcome: "APPROVED_FOR_DISPATCH" });
    const longNote = Object.assign(new CreateAgencyRecommendationReviewDto(), dto(), { note: "x".repeat(501) });
    expect(validateSync(invalidOutcome).some((error) => error.property === "outcome")).toBe(true);
    expect(validateSync(longNote).some((error) => error.property === "note")).toBe(true);
  });

  it("returns exact zero-review reporting semantics", async () => {
    const { service, prisma } = buildService();
    const result = await service.qualityReport(actor, new AgencyRecommendationQualityReportQueryDto());
    expect(result.summary.totalReviewed).toBe(0);
    expect(result.summary.acceptanceRate).toBe(null);
    expect(result.summary.acceptanceRateDefinition).toBe("ACCEPTED_AS_RELEVANT / TOTAL REVIEWED");
    expect(prisma.agencyRecommendationReview.findMany.mock.calls[0][0].where).toEqual({
      countryName: "Nigeria",
      stateName: "Lagos",
    });
    expect(prisma.agencyRecommendationReview.findMany.mock.calls[1][0].where).toEqual({
      countryName: "Nigeria",
      stateName: "Lagos",
    });
  });

  it("aggregates outcomes and surfaces human-only data-quality findings", async () => {
    const { service, prisma } = buildService();
    prisma.agencyRecommendationReview.count.mockResolvedValue(3);
    prisma.agencyRecommendationReview.groupBy.mockResolvedValue([
      { outcome: "ACCEPTED_AS_RELEVANT", _count: { _all: 2 } },
      { outcome: "OUTDATED_DIRECTORY_DATA", _count: { _all: 1 } },
    ]);
    prisma.agencyRecommendationReview.findMany.mockResolvedValue([{
      id: "review-1",
      outcome: "OUTDATED_DIRECTORY_DATA",
      agencyId: actionable.agencyId,
      agencyName: actionable.agencyName,
      endpointId: actionable.officeId,
      stateName: "Lagos",
      reviewedAt: new Date("2026-08-31T15:00:00.000Z"),
      note: "Verification is stale.",
    }]);
    const result = await service.qualityReport(actor, new AgencyRecommendationQualityReportQueryDto());
    expect(result.summary.acceptanceRate).toBe(2 / 3);
    expect(result.dataQualityFindings[0]).toEqual(expect.objectContaining({
      findingType: "OUTDATED_DIRECTORY_DATA",
      humanReviewRequired: true,
      automaticDirectoryChange: false,
    }));
  });

  it("does not change directory, routing, communication, incident, or dispatch state", async () => {
    const { service, prisma } = buildService();
    await service.createReview(incident.id, dto() as never, actor);
    expect(prisma.agency.update.mock.calls.length).toBe(0);
    expect(prisma.agencyJurisdiction.update.mock.calls.length).toBe(0);
    expect(prisma.agencyIncidentCapability.update.mock.calls.length).toBe(0);
    expect(prisma.incident.update.mock.calls.length).toBe(0);
    expect(prisma.dispatchEvent.create.mock.calls.length).toBe(0);
    expect(prisma.notification.create.mock.calls.length).toBe(0);
  });
});
