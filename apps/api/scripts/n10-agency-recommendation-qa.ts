import "reflect-metadata";
import { performance } from "node:perf_hooks";
import { AdminRoleName } from "@the-eye/shared";
import { AuditService } from "../src/modules/audit/audit.service";
import { AgencyRecommendationReviewService } from "../src/modules/dispatch/agency-recommendation-review.service";
import {
  AGENCY_RECOMMENDATION_RULE_VERSION,
  AgencyRoutingService,
  type AdvisoryAgencyRecommendation,
} from "../src/modules/dispatch/agency-routing.service";
import { IncidentsService } from "../src/modules/incidents/incidents.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";

const DATASET_VERSION = "n10-v1";
const APPROVED_DATABASE = "the_eye_n1_cert_20260831";
const REVIEW_COHORT = process.env.N10_REVIEW_COHORT?.trim() || "v1";
const REVIEW_NOTE_PREFIX = `[N10 ${REVIEW_COHORT}]`;

type QaScenario = {
  key: string;
  label: string;
  incidentType: "Fire" | "Accident" | "Crime" | "Emergency" | "Medical";
  priority: "P1LifeThreatening" | "P2ActiveCrimeAccident";
  variant: string;
  zeroCoordinates?: boolean;
};

type QaCase = QaScenario & {
  caseId: string;
  state: string;
  lga: string;
};

type ReviewOutcome =
  | "ACCEPTED_AS_RELEVANT"
  | "NOT_RELEVANT"
  | "INSUFFICIENT_OPERATIONAL_DATA"
  | "WRONG_JURISDICTION"
  | "WRONG_CAPABILITY"
  | "OUTDATED_DIRECTORY_DATA"
  | "OTHER";

const FIRE: QaScenario = {
  key: "fire",
  label: "Fire",
  incidentType: "Fire",
  priority: "P1LifeThreatening",
  variant: "State and federal fire coverage",
};
const ACCIDENT: QaScenario = {
  key: "road-crash",
  label: "Road crash / Accident",
  incidentType: "Accident",
  priority: "P1LifeThreatening",
  variant: "Multi-agency road safety and rescue coverage",
};
const CRIME: QaScenario = {
  key: "armed-robbery",
  label: "Armed robbery / Crime",
  incidentType: "Crime",
  priority: "P1LifeThreatening",
  variant: "Police and civil-defence relevance",
};
const SECURITY: QaScenario = {
  key: "security-emergency",
  label: "General security emergency",
  incidentType: "Emergency",
  priority: "P1LifeThreatening",
  variant: "Broad emergency responder coverage",
  zeroCoordinates: true,
};
const FLOOD: QaScenario = {
  key: "flood",
  label: "Flood",
  incidentType: "Emergency",
  priority: "P2ActiveCrimeAccident",
  variant: "Disaster-management coverage using the valid Emergency type",
};
const COLLAPSE: QaScenario = {
  key: "building-collapse",
  label: "Building collapse / disaster",
  incidentType: "Emergency",
  priority: "P1LifeThreatening",
  variant: "Rescue and emergency-management coverage",
};
const MEDICAL: QaScenario = {
  key: "medical",
  label: "Medical emergency",
  incidentType: "Medical",
  priority: "P1LifeThreatening",
  variant: "Medical capability where explicitly mapped",
};

const caseGroup = (state: string, lga: string, scenarios: QaScenario[]): QaCase[] =>
  scenarios.map((scenario) => ({
    ...scenario,
    state,
    lga,
    caseId: `${DATASET_VERSION}-${slug(state)}-${scenario.key}`,
  }));

export const N10_QA_CASES: QaCase[] = [
  ...caseGroup("Lagos", "Ikeja", [FIRE, ACCIDENT, CRIME, SECURITY, FLOOD, COLLAPSE, MEDICAL]),
  ...caseGroup("Federal Capital Territory", "Municipal", [FIRE, ACCIDENT, CRIME, FLOOD, MEDICAL]),
  ...caseGroup("Rivers", "Port Harcourt", [FIRE, ACCIDENT, CRIME, FLOOD, MEDICAL]),
  ...caseGroup("Benue", "Makurdi", [FIRE, ACCIDENT, CRIME, FLOOD, MEDICAL]),
  ...caseGroup("Kano", "Kano Municipal", [FIRE, ACCIDENT, CRIME, FLOOD, MEDICAL]),
  ...caseGroup("Enugu", "Enugu North", [FIRE, ACCIDENT, CRIME, COLLAPSE, MEDICAL]),
  ...caseGroup("Borno", "Maiduguri M. C.", [FIRE, ACCIDENT, CRIME, SECURITY, MEDICAL]),
  ...caseGroup("Oyo", "Ibadan North", [FIRE, ACCIDENT, CRIME, FLOOD, MEDICAL]),
  ...caseGroup("Abia", "Umuahia North", [FIRE, ACCIDENT, CRIME, COLLAPSE, MEDICAL]),
];

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function assertSafeDatabase() {
  for (const name of ["DATABASE_URL", "DATABASE_DIRECT_URL"]) {
    const raw = process.env[name];
    if (!raw) throw new Error(`${name} is required`);
    const url = new URL(raw);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (!local || url.pathname.slice(1) !== APPROVED_DATABASE) {
      throw new Error(`${name} must target the isolated N10 certification database`);
    }
  }
}

function percentile(values: number[], fraction: number) {
  if (!values.length) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)];
}

function stableDirectorySnapshot(rows: unknown[]) {
  return JSON.stringify(rows, (_key, value) => value instanceof Date ? value.toISOString() : value);
}

async function main() {
  assertSafeDatabase();
  if (N10_QA_CASES.length < 40) throw new Error("N10 requires at least 40 diverse QA cases");

  const prisma = new PrismaService();
  await prisma.$connect();
  const audit = new AuditService(prisma);
  const unused = undefined as never;
  const incidents = new IncidentsService(
    prisma, audit, unused, unused, unused, unused, unused, unused,
    unused, unused, unused, unused, unused, unused, unused,
  );
  const routing = new AgencyRoutingService(prisma);
  const reviewService = new AgencyRecommendationReviewService(prisma, incidents, routing, audit);

  const country = await prisma.country.findFirstOrThrow({ where: { name: "Nigeria", isActive: true } });
  const role = await prisma.adminRole.upsert({
    where: { name: AdminRoleName.SuperAdmin },
    update: {},
    create: { name: AdminRoleName.SuperAdmin, permissions: ["incident:read"] },
  });
  const seedState = await prisma.administrativeState.findFirstOrThrow({
    where: { countryId: country.id, name: "Lagos", isActive: true },
  });
  const seedLga = await prisma.localGovernmentArea.findFirstOrThrow({
    where: { stateId: seedState.id, name: "Ikeja", isActive: true },
  });
  const seedJurisdiction = (await prisma.jurisdiction.findFirst({
    where: { country: "Nigeria", state: seedState.name, lga: seedLga.name },
  })) ?? await prisma.jurisdiction.create({
    data: {
      countryRefId: country.id,
      stateRefId: seedState.id,
      lgaRefId: seedLga.id,
      country: "Nigeria",
      state: seedState.name,
      lga: seedLga.name,
      name: "N10 QA - Ikeja",
    },
  });
  const reviewer = await prisma.adminUser.upsert({
    where: { email: "n10-qa-reviewer@theeye.invalid" },
    update: { roleId: role.id, jurisdictionId: seedJurisdiction.id, isActive: true },
    create: {
      email: "n10-qa-reviewer@theeye.invalid",
      passwordHash: "n10-certification-no-login",
      displayName: "N10 QA Reviewer",
      roleId: role.id,
      jurisdictionId: seedJurisdiction.id,
      country: "Nigeria",
      state: "",
      lga: "",
      isActive: true,
    },
  });
  const actor = {
    sub: reviewer.id,
    typ: "admin" as const,
    role: AdminRoleName.SuperAdmin,
    country: "Nigeria",
    state: "",
    lga: "",
    permissions: ["incident:read"],
  };

  const directoryBefore = await directorySnapshot(prisma);
  const nonQaIncidentsBefore = stableDirectorySnapshot(
    (await prisma.incident.findMany({
      select: { id: true, clientSubmissionId: true, status: true, statusVersion: true, assignedAgencyId: true },
      orderBy: { id: "asc" },
    })).filter((item) => !item.clientSubmissionId?.startsWith(`${DATASET_VERSION}-`)),
  );
  const dispatchBefore = await prisma.dispatchEvent.count();
  const notificationBefore = await prisma.notification.count();

  const stateCache = new Map<string, { id: string; name: string }>();
  const lgaCache = new Map<string, { id: string; name: string }>();
  const incidentIds: string[] = [];
  const incidentByCase = new Map<string, { id: string }>();
  for (const fixture of N10_QA_CASES) {
    let state = stateCache.get(fixture.state);
    if (!state) {
      state = await prisma.administrativeState.findFirstOrThrow({
        where: { countryId: country.id, name: fixture.state, isActive: true },
        select: { id: true, name: true },
      });
      stateCache.set(fixture.state, state);
    }
    const lgaKey = `${fixture.state}:${fixture.lga}`;
    let lga = lgaCache.get(lgaKey);
    if (!lga) {
      lga = await prisma.localGovernmentArea.findFirstOrThrow({
        where: { stateId: state.id, name: fixture.lga, isActive: true },
        select: { id: true, name: true },
      });
      lgaCache.set(lgaKey, lga);
    }
    const jurisdiction = (await prisma.jurisdiction.findFirst({
      where: { country: "Nigeria", state: state.name, lga: lga.name },
    })) ?? await prisma.jurisdiction.create({
      data: {
        countryRefId: country.id,
        stateRefId: state.id,
        lgaRefId: lga.id,
        country: "Nigeria",
        state: state.name,
        lga: lga.name,
        name: `N10 QA - ${lga.name}`,
      },
    });
    const incident = await prisma.incident.upsert({
      where: { clientSubmissionId: fixture.caseId },
      update: {
        jurisdictionId: jurisdiction.id,
        type: fixture.incidentType,
        status: "Submitted",
        priority: fixture.priority,
        title: `N10 QA: ${fixture.label}`,
        address: "QA location precision intentionally unavailable",
        country: "Nigeria",
        state: fixture.state,
        lga: fixture.lga,
        latitude: fixture.zeroCoordinates ? 0 : null,
        longitude: fixture.zeroCoordinates ? 0 : null,
        metadata: { dataset: DATASET_VERSION, scenario: fixture.label, variant: fixture.variant },
      },
      create: {
        clientSubmissionId: fixture.caseId,
        jurisdictionId: jurisdiction.id,
        type: fixture.incidentType,
        status: "Submitted",
        priority: fixture.priority,
        title: `N10 QA: ${fixture.label}`,
        address: "QA location precision intentionally unavailable",
        country: "Nigeria",
        state: fixture.state,
        lga: fixture.lga,
        latitude: fixture.zeroCoordinates ? 0 : null,
        longitude: fixture.zeroCoordinates ? 0 : null,
        metadata: { dataset: DATASET_VERSION, scenario: fixture.label, variant: fixture.variant },
        isAnonymous: true,
      },
    });
    incidentIds.push(incident.id);
    incidentByCase.set(fixture.caseId, incident);
  }

  const latencies: number[] = [];
  const matrix: Array<Record<string, unknown>> = [];
  let reviewsCreated = 0;
  let reviewsReused = 0;
  let presentationIssues = 0;
  let crossStateLeaks = 0;
  let unqualifiedDistanceLeaks = 0;
  let outboundMetaCalls = 0;
  const affectedByIssue = new Map<string, string[]>();

  for (const fixture of N10_QA_CASES) {
    const incident = await prisma.incident.findUniqueOrThrow({
      where: { id: incidentByCase.get(fixture.caseId)!.id },
    });
    const started = performance.now();
    const preview = await routing.previewIncident(incident, actor);
    latencies.push(performance.now() - started);
    if (preview.ruleVersion !== AGENCY_RECOMMENDATION_RULE_VERSION) {
      throw new Error(`Unexpected rule version for ${fixture.caseId}`);
    }
    outboundMetaCalls += preview.meta.outboundCommunicationCalls;
    const recommendations = [
      ...preview.actionableRecommendations,
      ...preview.structuralMatches,
      ...preview.informationalMatches,
    ];
    const outcomes: ReviewOutcome[] = [];
    const issueClasses = new Set<string>();
    const state = stateCache.get(fixture.state)!;
    const lga = lgaCache.get(`${fixture.state}:${fixture.lga}`)!;

    for (const recommendation of recommendations) {
      const evaluation = await evaluateRecommendation(prisma, recommendation, fixture, country.id, state.id, lga.id);
      outcomes.push(evaluation.outcome);
      issueClasses.add(evaluation.issueClassification);
      if (evaluation.issueClassification !== "NONE") {
        const refs = affectedByIssue.get(evaluation.issueClassification) ?? [];
        refs.push(fixture.caseId);
        affectedByIssue.set(evaluation.issueClassification, refs);
      }
      if (evaluation.crossStateLeak) crossStateLeaks += 1;
      if (evaluation.unqualifiedDistanceLeak) unqualifiedDistanceLeaks += 1;
      if (evaluation.presentationIssue) presentationIssues += 1;

      const recommendationKey = `${recommendation.agencyId}:${recommendation.endpointType}:${recommendation.officeId ?? "structural"}`;
      const existing = await prisma.agencyRecommendationReview.findFirst({
        where: {
          incidentId: incident.id,
          recommendationKey,
          reviewerAdminId: reviewer.id,
          note: { startsWith: REVIEW_NOTE_PREFIX },
        },
        orderBy: [{ reviewedAt: "desc" }, { id: "desc" }],
      });
      if (existing) {
        reviewsReused += 1;
      } else {
        await reviewService.createReview(incident.id, {
          agencyId: recommendation.agencyId,
          endpointId: recommendation.officeId ?? undefined,
          endpointType: recommendation.endpointType,
          outcome: evaluation.outcome,
          note: `${REVIEW_NOTE_PREFIX} ${evaluation.note}`,
        }, actor);
        reviewsCreated += 1;
      }
    }

    matrix.push({
      caseId: fixture.caseId,
      state: fixture.state,
      category: fixture.label,
      incidentType: fixture.incidentType,
      primary: preview.actionableRecommendations.filter((item) => item.tier === "PRIMARY").length,
      secondary: preview.actionableRecommendations.filter((item) => item.tier === "SECONDARY").length,
      structural: preview.structuralMatches.length,
      informational: preview.informationalMatches.length,
      operationalMatch: preview.actionableRecommendations.length > 0,
      reviewOutcomes: countValues(outcomes),
      issueClassification: [...issueClasses].sort(),
      limitations: preview.limitations,
    });
  }

  const persistedReviews = await prisma.agencyRecommendationReview.findMany({
    where: {
      incidentId: { in: incidentIds },
      reviewerAdminId: reviewer.id,
      note: { startsWith: REVIEW_NOTE_PREFIX },
    },
    include: { incident: { select: { clientSubmissionId: true } } },
    orderBy: [{ reviewedAt: "asc" }, { id: "asc" }],
  });
  const reviewOutcomes = countValues(persistedReviews.map((review) => review.outcome));
  const categoryBreakdown = breakdown(N10_QA_CASES, persistedReviews, "label", incidentByCase);
  const stateBreakdown = breakdown(N10_QA_CASES, persistedReviews, "state", incidentByCase);
  const agencyBreakdown = groupedReviewOutcomes(
    persistedReviews.map((review) => ({ group: review.agencyName, outcome: review.outcome })),
  );
  const tierBreakdown = countValues(persistedReviews.map((review) => review.recommendationTier));
  const ruleVersionBreakdown = countValues(
    persistedReviews.map((review) => review.recommendationRuleVersion),
  );

  const reportFilters = await validateReportFilters(
    reviewService,
    actor,
    persistedReviews,
    stateCache,
  );

  const firstLagos = matrix.find((row) => row.state === "Lagos");
  const firstRecommendationReview = persistedReviews[0];
  let crossStateDenied = false;
  if (firstLagos && firstRecommendationReview) {
    const riversAdmin = await prisma.adminUser.findUnique({ where: { email: "n9-cert-rivers@theeye.invalid" } });
    if (riversAdmin) {
      try {
        await reviewService.createReview(
          incidentByCase.get(String(firstLagos.caseId))!.id,
          {
            agencyId: firstRecommendationReview.agencyId,
            endpointId: firstRecommendationReview.endpointId ?? undefined,
            endpointType: firstRecommendationReview.endpointType,
            outcome: "NOT_RELEVANT",
          },
          {
            sub: riversAdmin.id,
            typ: "admin",
            role: AdminRoleName.StateAdmin,
            country: "Nigeria",
            state: "Rivers",
            lga: "Port Harcourt",
            permissions: ["incident:read"],
          },
        );
      } catch {
        crossStateDenied = true;
      }
    }
  }

  const directoryAfter = await directorySnapshot(prisma);
  const nonQaIncidentsAfter = stableDirectorySnapshot(
    (await prisma.incident.findMany({
      select: { id: true, clientSubmissionId: true, status: true, statusVersion: true, assignedAgencyId: true },
      orderBy: { id: "asc" },
    })).filter((item) => !item.clientSubmissionId?.startsWith(`${DATASET_VERSION}-`)),
  );
  const dispatchAfter = await prisma.dispatchEvent.count();
  const notificationAfter = await prisma.notification.count();

  const accepted = reviewOutcomes.ACCEPTED_AS_RELEVANT ?? 0;
  const totalReviewed = persistedReviews.length;
  const zeroActionable = matrix.filter((row) => row.operationalMatch === false);
  const noStateSpecific = matrix.filter((row) => {
    const caseId = String(row.caseId);
    const fixture = N10_QA_CASES.find((item) => item.caseId === caseId)!;
    const caseReviews = persistedReviews.filter((review) => review.incident.clientSubmissionId === caseId);
    return !caseReviews.some((review) => review.agencyName.toLowerCase().includes(fixture.state.toLowerCase()));
  });

  const result = {
    dataset: {
      version: DATASET_VERSION,
      reviewCohort: REVIEW_COHORT,
      ruleVersion: AGENCY_RECOMMENDATION_RULE_VERSION,
      incidentsEvaluated: N10_QA_CASES.length,
      jurisdictions: [...new Set(N10_QA_CASES.map((item) => item.state))],
      categories: [...new Set(N10_QA_CASES.map((item) => item.label))],
      reviewsCreated,
      reviewsReused,
    },
    reviews: {
      totalReviewed,
      ...reviewOutcomes,
      acceptanceRate: totalReviewed ? accepted / totalReviewed : null,
      acceptanceRateDefinition: "ACCEPTED_AS_RELEVANT / TOTAL REVIEWED",
    },
    breakdowns: {
      category: categoryBreakdown,
      state: stateBreakdown,
      agency: agencyBreakdown,
      tier: tierBreakdown,
      ruleVersion: ruleVersionBreakdown,
    },
    scenarios: {
      zeroActionable: zeroActionable.length,
      operational: matrix.length - zeroActionable.length,
      structuralOnlyReviews: persistedReviews.filter((review) => review.recommendationTier === "STRUCTURAL_ONLY").length,
      coordinateQualifiedRecommendations: persistedReviews.filter((review) => review.qualifiedDistanceMeters != null).length,
      casesWithoutStateSpecificRecommendation: noStateSpecific.length,
    },
    findings: {
      ruleQuality: {
        wrongCapability: reviewOutcomes.WRONG_CAPABILITY ?? 0,
        wrongJurisdiction: reviewOutcomes.WRONG_JURISDICTION ?? 0,
        notRelevant: reviewOutcomes.NOT_RELEVANT ?? 0,
        other: reviewOutcomes.OTHER ?? 0,
      },
      directoryData: {
        insufficientOperationalData: reviewOutcomes.INSUFFICIENT_OPERATIONAL_DATA ?? 0,
        outdatedDirectoryData: reviewOutcomes.OUTDATED_DIRECTORY_DATA ?? 0,
        noQualifiedCoordinates: persistedReviews.filter((review) => review.qualifiedDistanceMeters == null).length,
      },
      presentationIssues,
      authorizationIssues: crossStateDenied && crossStateLeaks === 0 ? 0 : 1,
      evidenceReferences: Object.fromEntries(
        [...affectedByIssue.entries()].map(([key, values]) => [key, [...new Set(values)].slice(0, 12)]),
      ),
    },
    reportFilters,
    latencyMs: {
      evaluations: latencies.length,
      average: average(latencies),
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      maximum: Math.max(...latencies),
    },
    safety: {
      directoryMutation: directoryBefore === directoryAfter ? 0 : 1,
      nonQaIncidentMutation: nonQaIncidentsBefore === nonQaIncidentsAfter ? 0 : 1,
      dispatchMutation: dispatchAfter - dispatchBefore,
      notificationMutation: notificationAfter - notificationBefore,
      outboundCommunicationCalls: outboundMetaCalls,
      crossStateLeaks,
      unqualifiedDistanceLeaks,
      automaticDispatch: "DISABLED",
      automaticEscalation: "DISABLED",
    },
    n11Backlog: buildBacklog({
      insufficient: reviewOutcomes.INSUFFICIENT_OPERATIONAL_DATA ?? 0,
      outdated: reviewOutcomes.OUTDATED_DIRECTORY_DATA ?? 0,
      noCoordinates: persistedReviews.filter((review) => review.qualifiedDistanceMeters == null).length,
      noStateSpecific: noStateSpecific.length,
      ruleIssues: (reviewOutcomes.WRONG_CAPABILITY ?? 0)
        + (reviewOutcomes.WRONG_JURISDICTION ?? 0)
        + (reviewOutcomes.NOT_RELEVANT ?? 0)
        + (reviewOutcomes.OTHER ?? 0),
      zeroActionable: zeroActionable.length,
      matrix,
    }),
    matrix,
  };

  assertCertified(result);
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}

async function evaluateRecommendation(
  prisma: PrismaService,
  recommendation: AdvisoryAgencyRecommendation,
  fixture: QaCase,
  countryId: string,
  stateId: string,
  lgaId: string,
) {
  const [agency, capability, jurisdictionCount] = await Promise.all([
    prisma.agency.findUniqueOrThrow({
      where: { id: recommendation.agencyId },
      select: { stateCode: true },
    }),
    prisma.agencyIncidentCapability.count({
      where: { agencyId: recommendation.agencyId, incidentType: fixture.incidentType, isActive: true },
    }),
    prisma.agencyJurisdiction.count({
      where: {
        agencyId: recommendation.agencyId,
        isActive: true,
        OR: [
          { coverageType: "NATIONAL", countryId },
          { stateId },
          { lgaId },
        ],
      },
    }),
  ]);
  const crossStateLeak = Boolean(agency.stateCode && agency.stateCode !== fixture.state);
  const capabilityValid = capability > 0;
  const jurisdictionValid = jurisdictionCount > 0 && !crossStateLeak;
  const unqualifiedDistanceLeak = recommendation.distanceMeters != null
    && !recommendation.coordinateQualified;
  const presentationIssue = (
    recommendation.tier === "STRUCTURAL_ONLY"
    && recommendation.limitations.length === 0
  ) || (
    ["PRIMARY", "SECONDARY"].includes(recommendation.tier)
    && !recommendation.operationalReady
  );

  let outcome: ReviewOutcome;
  let issueClassification: string;
  let note: string;
  if (!capabilityValid) {
    outcome = "WRONG_CAPABILITY";
    issueClassification = "RULE_QUALITY_ISSUE";
    note = "Returned agency lacks the required active capability mapping.";
  } else if (!jurisdictionValid) {
    outcome = "WRONG_JURISDICTION";
    issueClassification = "AUTHORIZATION_OR_RULE_ISSUE";
    note = "Returned agency does not have matching active jurisdiction evidence.";
  } else if (!recommendation.factors.verificationCurrent) {
    outcome = "OUTDATED_DIRECTORY_DATA";
    issueClassification = "DIRECTORY_DATA_ISSUE";
    note = "Relevant match, but directory verification freshness requires human review.";
  } else if (!recommendation.operationalReady) {
    outcome = "INSUFFICIENT_OPERATIONAL_DATA";
    issueClassification = "DIRECTORY_DATA_ISSUE";
    note = "Relevant structural match, but no verified operational endpoint is available.";
  } else if (presentationIssue || unqualifiedDistanceLeak) {
    outcome = "OTHER";
    issueClassification = "UI_PRESENTATION_ISSUE";
    note = "Recommendation is relevant, but its tier, limitation, or distance presentation is inconsistent.";
  } else {
    outcome = "ACCEPTED_AS_RELEVANT";
    issueClassification = "NONE";
    note = "Capability, jurisdiction, tier, and operational evidence are appropriate.";
  }
  return { outcome, issueClassification, note, crossStateLeak, unqualifiedDistanceLeak, presentationIssue };
}

async function directorySnapshot(prisma: PrismaService) {
  const [agencies, offices, contacts, jurisdictions, capabilities] = await Promise.all([
    prisma.agency.findMany({ select: { id: true, updatedAt: true, verificationStatus: true }, orderBy: { id: "asc" } }),
    prisma.agencyOffice.findMany({ select: { id: true, updatedAt: true, verificationStatus: true }, orderBy: { id: "asc" } }),
    prisma.agencyContact.findMany({ select: { id: true, updatedAt: true, verificationStatus: true }, orderBy: { id: "asc" } }),
    prisma.agencyJurisdiction.findMany({ select: { id: true, updatedAt: true, isActive: true }, orderBy: { id: "asc" } }),
    prisma.agencyIncidentCapability.findMany({ select: { id: true, updatedAt: true, isActive: true }, orderBy: { id: "asc" } }),
  ]);
  return stableDirectorySnapshot([agencies, offices, contacts, jurisdictions, capabilities]);
}

function countValues(values: Array<string | null | undefined>) {
  const result: Record<string, number> = {};
  for (const value of values) {
    if (value) result[value] = (result[value] ?? 0) + 1;
  }
  return result;
}

function groupedReviewOutcomes(rows: Array<{ group: string; outcome: string }>) {
  const result: Record<string, { reviewed: number; outcomes: Record<string, number> }> = {};
  for (const row of rows) {
    result[row.group] ??= { reviewed: 0, outcomes: {} };
    result[row.group].reviewed += 1;
    result[row.group].outcomes[row.outcome] =
      (result[row.group].outcomes[row.outcome] ?? 0) + 1;
  }
  return result;
}

function breakdown(
  fixtures: QaCase[],
  reviews: Array<{ incidentId: string; outcome: string }>,
  key: "label" | "state",
  incidentByCase: Map<string, { id: string }>,
) {
  const groups: Record<string, { incidents: number; reviewed: number; outcomes: Record<string, number> }> = {};
  for (const fixture of fixtures) {
    const label = fixture[key];
    groups[label] ??= { incidents: 0, reviewed: 0, outcomes: {} };
    groups[label].incidents += 1;
    const incidentId = incidentByCase.get(fixture.caseId)!.id;
    const matching = reviews.filter((review) => review.incidentId === incidentId);
    groups[label].reviewed += matching.length;
    for (const review of matching) {
      groups[label].outcomes[review.outcome] = (groups[label].outcomes[review.outcome] ?? 0) + 1;
    }
  }
  return groups;
}

async function validateReportFilters(
  service: AgencyRecommendationReviewService,
  actor: Parameters<AgencyRecommendationReviewService["qualityReport"]>[0],
  reviews: Array<{
    recommendationRuleVersion: string;
    stateId: string;
    incidentType: string;
    agencyId: string;
    recommendationTier: string;
    outcome: string;
    reviewedAt: Date;
  }>,
  states: Map<string, { id: string }>,
) {
  const first = reviews[0];
  if (!first) throw new Error("No N10 reviews were persisted");
  const earliest = new Date(Math.min(...reviews.map((review) => review.reviewedAt.getTime())) - 1_000).toISOString();
  const latest = new Date(Math.max(...reviews.map((review) => review.reviewedAt.getTime())) + 1_000).toISOString();
  const checks = {
    ruleVersion: await service.qualityReport(actor, { ruleVersion: AGENCY_RECOMMENDATION_RULE_VERSION, limit: 500 }),
    state: await service.qualityReport(actor, { stateId: states.get("Lagos")!.id, limit: 500 }),
    category: await service.qualityReport(actor, { incidentType: first.incidentType, limit: 500 }),
    agency: await service.qualityReport(actor, { agencyId: first.agencyId, limit: 500 }),
    tier: await service.qualityReport(actor, { tier: first.recommendationTier, limit: 500 }),
    outcome: await service.qualityReport(actor, { outcome: first.outcome, limit: 500 }),
    date: await service.qualityReport(actor, { reviewedFrom: earliest, reviewedTo: latest, limit: 500 }),
    zero: await service.qualityReport(actor, { reviewedFrom: "2099-01-01T00:00:00.000Z", limit: 500 }),
  };
  return {
    ruleVersion: checks.ruleVersion.reviews.every((review) => review.recommendationRuleVersion === AGENCY_RECOMMENDATION_RULE_VERSION),
    state: checks.state.reviews.every((review) => review.stateName === "Lagos"),
    category: checks.category.reviews.every((review) => review.incidentType === first.incidentType),
    agency: checks.agency.reviews.every((review) => review.agencyId === first.agencyId),
    tier: checks.tier.reviews.every((review) => review.recommendationTier === first.recommendationTier),
    outcome: checks.outcome.reviews.every((review) => review.outcome === first.outcome),
    date: checks.date.summary.totalReviewed >= reviews.length,
    zero: checks.zero.summary.totalReviewed === 0 && checks.zero.summary.acceptanceRate === null,
  };
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function buildBacklog(input: {
  insufficient: number;
  outdated: number;
  noCoordinates: number;
  noStateSpecific: number;
  ruleIssues: number;
  zeroActionable: number;
  matrix: Array<Record<string, unknown>>;
}) {
  const candidates: Array<Record<string, unknown>> = [];
  if (input.insufficient) candidates.push({
    issue: "Relevant agencies lack verified operational endpoints or contacts",
    affectedCases: input.insufficient,
    classification: "DIRECTORY_DATA_ISSUE",
    severity: "HIGH",
    proposedDirection: "Prioritize provenance-backed endpoint and public-contact verification; do not change ranking yet.",
    evidence: input.matrix.filter((row) => row.operationalMatch === false).slice(0, 10).map((row) => row.caseId),
  });
  if (input.noCoordinates) candidates.push({
    issue: "No recommendation has qualified coordinates for distance ordering",
    affectedCases: input.noCoordinates,
    classification: "DIRECTORY_DATA_ISSUE",
    severity: "MEDIUM",
    proposedDirection: "Collect authoritative or verified-address geocodes with provenance; retain no-centroid policy.",
    evidence: input.matrix.slice(0, 10).map((row) => row.caseId),
  });
  if (input.noStateSpecific) candidates.push({
    issue: "Several scenarios rely only on federal/national coverage",
    affectedCases: input.noStateSpecific,
    classification: "DIRECTORY_DATA_ISSUE",
    severity: "MEDIUM",
    proposedDirection: "Verify missing State responder capability and endpoint records before considering rule changes.",
    evidence: input.matrix.filter((row) => row.operationalMatch === false).slice(0, 10).map((row) => row.caseId),
  });
  if (input.zeroActionable) candidates.push({
    issue: "Zero-actionable scenarios require structural fallback",
    affectedCases: input.zeroActionable,
    classification: "DIRECTORY_DATA_ISSUE",
    severity: "HIGH",
    proposedDirection: "Close operational directory gaps while preserving explicit structural-only limitations.",
    evidence: input.matrix.filter((row) => row.operationalMatch === false).slice(0, 10).map((row) => row.caseId),
  });
  if (input.outdated) candidates.push({
    issue: "Directory verification freshness is outside the v1 freshness window",
    affectedCases: input.outdated,
    classification: "DIRECTORY_DATA_ISSUE",
    severity: "MEDIUM",
    proposedDirection: "Reverify provenance and timestamps through human directory governance.",
    evidence: [],
  });
  if (input.ruleIssues) candidates.push({
    issue: "Recommendation-rule quality findings require N11 analysis",
    affectedCases: input.ruleIssues,
    classification: "RULE_QUALITY_ISSUE",
    severity: "HIGH",
    proposedDirection: "Review affected evidence before changing agency-recommendation-v1.",
    evidence: [],
  });
  return candidates;
}

function assertCertified(result: {
  reportFilters: Record<string, boolean>;
  safety: Record<string, string | number>;
}) {
  if (Object.values(result.reportFilters).some((value) => !value)) {
    throw new Error("One or more N9 QA report filters failed validation");
  }
  for (const field of [
    "directoryMutation",
    "nonQaIncidentMutation",
    "dispatchMutation",
    "notificationMutation",
    "outboundCommunicationCalls",
    "crossStateLeaks",
    "unqualifiedDistanceLeaks",
  ]) {
    if (result.safety[field] !== 0) throw new Error(`N10 safety assertion failed: ${field}`);
  }
}

main().catch((error) => {
  console.error(error?.name ?? "Error", error?.message ?? "N10 QA failed");
  process.exitCode = 1;
});
