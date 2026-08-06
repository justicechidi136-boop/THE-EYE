import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { IncidentStatus, IncidentType } from "@the-eye/shared";
import { CommunityVerificationEligibilityService } from "../community-verification-eligibility.service";
import { CommunityVerificationSafePayloadService } from "../community-verification-safe-payload.service";
import { CommunityVerificationScoringService } from "../community-verification-scoring.service";
import { CommunityVerificationService } from "../community-verification.service";
import { buildCommunityVerificationNotificationMetadata } from "../../notifications/notification-routing.schema";

const userActor = { typ: "user", sub: "user-verifier-1" } as const;
const otherUser = { typ: "user", sub: "user-other-2" } as const;
const adminActor = { typ: "admin", sub: "admin-1", permissions: ["incident:update", "incident:read"] } as const;

function buildPrismaMock(overrides: Record<string, unknown> = {}) {
  const store = {
    requests: new Map<string, any>(),
    responses: new Map<string, any>(),
    incidents: new Map<string, any>([
      [
        "inc-1",
        {
          id: "inc-1",
          reporterId: "reporter-1",
          type: IncidentType.SuspiciousActivity,
          status: IncidentStatus.Received,
          latitude: 6.5,
          longitude: 3.3,
          country: "NG",
          state: "LA",
          lga: "Ikeja",
          description: "Suspicious person near gate 6.5244, 3.3792",
          submittedAt: new Date("2026-08-06T10:00:00.000Z"),
          assignments: [],
          media: [],
        },
      ],
    ]),
    notifications: [] as any[],
    timeline: [] as any[],
  };

  const prisma = {
    incident: {
      findUnique: jest.fn(async ({ where }: any) => store.incidents.get(where.id) ?? null),
      findUniqueOrThrow: jest.fn(async ({ where }: any) => {
        const row = store.incidents.get(where.id);
        if (!row) throw new Error("missing");
        return row;
      }),
    },
    communityVerificationRequest: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `req-${store.requests.size + 1}`, response: null, ...data };
        store.requests.set(row.id, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => store.requests.get(where.id) ?? null),
      findMany: jest.fn(async () => [...store.requests.values()]),
      update: jest.fn(async ({ where, data }: any) => {
        const row = store.requests.get(where.id);
        Object.assign(row, data);
        return row;
      }),
      count: jest.fn(async () => store.requests.size),
      groupBy: jest.fn(async () => [{ status: "Delivered", _count: store.requests.size }]),
    },
    communityVerificationResponse: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `resp-${store.responses.size + 1}`, ...data };
        store.responses.set(row.clientActionId, row);
        const request = store.requests.get(data.requestId);
        if (request) request.response = row;
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.clientActionId) return store.responses.get(where.clientActionId) ?? null;
        return null;
      }),
      findFirst: jest.fn(async () => null),
      count: jest.fn(async () => store.responses.size),
      groupBy: jest.fn(async () => []),
      update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    },
    notification: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `notif-${store.notifications.length + 1}`, ...data };
        store.notifications.push(row);
        return row;
      }),
    },
    incidentTimeline: { create: jest.fn(async ({ data }: any) => store.timeline.push(data)) },
    user: {
      findUnique: jest.fn(async ({ where }: any) =>
        where.id === "reporter-1"
          ? { id: "reporter-1", status: "Active", createdAt: new Date("2024-01-01") }
          : { id: where.id, status: "Active", createdAt: new Date("2024-01-01"), trustedReporter: null },
      ),
      findUniqueOrThrow: jest.fn(async ({ where }: any) => ({
        id: where.id,
        status: "Active",
        createdAt: new Date("2024-01-01"),
        trustedReporter: null,
      })),
    },
    userPushToken: { findMany: jest.fn(async () => []) },
    $queryRaw: jest.fn(async () => []),
    ...overrides,
  };

  return { prisma, store };
}

describe("CommunityVerificationService", () => {
  it("builds notification metadata with verificationRequestId deep link", () => {
    const metadata = buildCommunityVerificationNotificationMetadata({
      incidentId: "inc-1",
      verificationRequestId: "req-1",
      category: "Fire",
      distanceBand: "WITHIN_500_M",
      issuedAt: "2026-08-06T10:00:00.000Z",
      expiresAt: "2026-08-06T10:45:00.000Z",
    });
    expect(metadata.routeType).toBe("COMMUNITY_VERIFICATION");
    expect(metadata.deepLink).toBe("/community-verification/req-1");
    expect(metadata.verificationRequestId).toBe("req-1");
  });

  it("returns 404-style NotFound for non-target users", async () => {
    const { prisma, store } = buildPrismaMock();
    store.requests.set("req-1", {
      id: "req-1",
      targetUserId: "user-verifier-1",
      incidentId: "inc-1",
      status: "Delivered",
      expiresAt: new Date(Date.now() + 60_000),
      approximateDistanceMeters: 200,
      distanceBand: "WITHIN_250_M",
      incident: store.incidents.get("inc-1"),
      response: null,
    });
    const service = new CommunityVerificationService(
      prisma as never,
      {} as never,
      new CommunityVerificationSafePayloadService(),
      new CommunityVerificationScoringService(prisma as never),
      { enqueue: jest.fn() } as never,
      { record: jest.fn() } as never,
    );
    await expect(service.getSafePayload("req-1", otherUser as never)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("sanitizes safe payload and hides exact coordinates in description", async () => {
    const { prisma, store } = buildPrismaMock();
    store.requests.set("req-1", {
      id: "req-1",
      targetUserId: "user-verifier-1",
      incidentId: "inc-1",
      status: "Delivered",
      expiresAt: new Date(Date.now() + 60_000),
      approximateDistanceMeters: 200,
      distanceBand: "WITHIN_250_M",
      incident: store.incidents.get("inc-1"),
      response: null,
    });
    const service = new CommunityVerificationService(
      prisma as never,
      {} as never,
      new CommunityVerificationSafePayloadService(),
      new CommunityVerificationScoringService(prisma as never),
      { enqueue: jest.fn() } as never,
      { record: jest.fn() } as never,
    );
    const payload = await service.getSafePayload("req-1", userActor as never);
    expect(payload.requestId).toBe("req-1");
    expect(payload.sanitizedDescription).toContain("[location redacted]");
    expect(JSON.stringify(payload)).not.toContain("reporter-1");
    expect(JSON.stringify(payload)).not.toContain("6.5244");
  });

  it("blocks reporter self-verification", async () => {
    const { prisma, store } = buildPrismaMock();
    store.requests.set("req-1", {
      id: "req-1",
      targetUserId: "reporter-1",
      incidentId: "inc-1",
      status: "Delivered",
      expiresAt: new Date(Date.now() + 60_000),
      approximateDistanceMeters: 200,
      distanceBand: "WITHIN_250_M",
      incident: store.incidents.get("inc-1"),
      response: null,
    });
    const service = new CommunityVerificationService(
      prisma as never,
      {} as never,
      new CommunityVerificationSafePayloadService(),
      new CommunityVerificationScoringService(prisma as never),
      { enqueue: jest.fn() } as never,
      { record: jest.fn() } as never,
    );
    await expect(
      service.respond(
        "req-1",
        { responseType: "Confirmed", clientActionId: "action-1" },
        { typ: "user", sub: "reporter-1" } as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("supports idempotent respond via clientActionId", async () => {
    const { prisma, store } = buildPrismaMock();
    store.requests.set("req-1", {
      id: "req-1",
      targetUserId: "user-verifier-1",
      incidentId: "inc-1",
      status: "Delivered",
      expiresAt: new Date(Date.now() + 60_000),
      approximateDistanceMeters: 200,
      distanceBand: "WITHIN_250_M",
      incident: store.incidents.get("inc-1"),
      response: null,
    });
    const service = new CommunityVerificationService(
      prisma as never,
      {} as never,
      new CommunityVerificationSafePayloadService(),
      new CommunityVerificationScoringService(prisma as never),
      { enqueue: jest.fn() } as never,
      { record: jest.fn() } as never,
    );
    const dto = { responseType: "Confirmed", clientActionId: "action-1", confidence: "High" };
    const first = await service.respond("req-1", dto, userActor as never);
    const second = await service.respond("req-1", dto, userActor as never);
    expect(first.completed).toBe(true);
    expect(second.completed).toBe(true);
    expect(prisma.communityVerificationResponse.create).toHaveBeenCalledTimes(1);
  });
});

describe("CommunityVerificationEligibilityService", () => {
  it("marks dangerous categories passive-only through incident evaluation metadata", async () => {
    const { prisma, store } = buildPrismaMock();
    store.incidents.set("inc-fire", {
      id: "inc-fire",
      reporterId: "reporter-1",
      type: IncidentType.Fire,
      status: IncidentStatus.Received,
      latitude: 6.5,
      longitude: 3.3,
      country: "NG",
      state: "LA",
      lga: "Ikeja",
      assignments: [],
    });
    prisma.$queryRaw = jest.fn(async () => [{ userId: "user-verifier-1", distanceMeters: 100 }]);
    prisma.communityVerificationRequest.findFirst = jest.fn(async () => null);
    const eligibility = new CommunityVerificationEligibilityService(prisma as never);
    const result = await eligibility.evaluateIncidentEligibility("inc-fire");
    expect(result.passiveOnly).toBe(true);
  });
});

describe("CommunityVerificationScoringService", () => {
  it("returns aggregate recommendation without raw vote count", async () => {
    const { prisma } = buildPrismaMock();
    prisma.communityVerificationResponse.findMany = jest.fn(async () => [
      {
        userId: "u1",
        responseType: "Confirmed",
        trustWeight: 1,
        approximateDistanceAtResponse: 100,
        user: { createdAt: new Date("2024-01-01"), trustedReporter: null },
      },
      {
        userId: "u2",
        responseType: "StillOngoing",
        trustWeight: 0.9,
        approximateDistanceAtResponse: 200,
        user: { createdAt: new Date("2024-01-01"), trustedReporter: null },
      },
    ]);
    prisma.incident.findUnique = jest.fn(async () => ({ type: IncidentType.SuspiciousActivity, assignments: [] }));
    const scoring = new CommunityVerificationScoringService(prisma as never);
    const score = await scoring.scoreIncident("inc-1");
    expect(score.confirmedScore).toBeGreaterThan(0);
    expect(score.safeSummaryText.length).toBeGreaterThan(10);
    expect(["NONE", "CONTINUE_VERIFICATION", "COMMUNITY_RESOLUTION_RECOMMENDED", "MANUAL_REVIEW_REQUIRED"].includes(score.recommendation)).toBe(true);
  });
});
