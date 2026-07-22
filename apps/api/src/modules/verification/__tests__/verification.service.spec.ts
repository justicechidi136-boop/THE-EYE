import { IncidentPriority, IncidentStatus } from "@the-eye/shared";
import { createMetricsMock } from "../../../common/metrics/metrics.test-utils";
import { VerificationService } from "../verification.service";

function buildPrisma(overrides: Record<string, unknown> = {}) {
  const incident = {
    id: "incident-1",
    type: "Emergency",
    title: "Emergency near Allen Avenue",
    priority: IncidentPriority.P1LifeThreatening,
    status: IncidentStatus.Submitted,
    reporterId: "user-1",
    country: "Nigeria",
    state: "Lagos",
    lga: "Ikeja",
    latitude: 6.6012,
    longitude: 3.3514,
    manualLatitude: 6.6013,
    manualLongitude: 3.3515,
    metadata: { gpsAccuracyMeters: 8 },
    createdAt: new Date(),
    media: [
      {
        id: "media-1",
        fileHash: "hash-1",
        latitude: 6.6012,
        longitude: 3.3514,
        capturedAt: new Date(),
        uploadedAt: new Date(),
        mediaType: "Image",
        accessLogs: [{ id: "log-1" }],
      },
      {
        id: "media-2",
        fileHash: "hash-2",
        latitude: 6.6011,
        longitude: 3.3513,
        capturedAt: new Date(),
        uploadedAt: new Date(),
        mediaType: "Video",
        accessLogs: [],
      },
      {
        id: "media-3",
        fileHash: "hash-3",
        latitude: 6.6013,
        longitude: 3.3515,
        capturedAt: new Date(),
        uploadedAt: new Date(),
        mediaType: "Image",
        accessLogs: [],
      },
    ],
    liveVideoSessions: [{ id: "live-1", endedAt: null }],
    reporter: { trustedReporter: { trustScore: 95, verificationLevel: "Premium", reportsSubmitted: 10, reportsVerified: 9, revokedAt: null } },
    verifications: [
      { method: "nearby_user_confirmation", result: "confirmed" },
      { method: "trusted_reporter_confirmation", result: "confirmed" },
      { method: "admin_system_review", result: "HighConfidence" },
    ],
  };
  return {
    incident: {
      findUnique: jest.fn().mockResolvedValue(incident),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({ id: "incident-1", status: IncidentStatus.Verified }),
    },
    incidentVerification: { create: jest.fn().mockResolvedValue({ id: "verification-1" }) },
    incidentTimeline: { create: jest.fn().mockResolvedValue({ id: "timeline-1" }) },
    incidentMedia: { findMany: jest.fn().mockResolvedValue([]) },
    notification: {
      createMany: jest.fn(),
      create: jest.fn().mockImplementation(async (args: any) => ({
        id: `notification-${args.data.userId}`,
        ...args.data,
      })),
    },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    trustedReporter: { findUnique: jest.fn().mockResolvedValue(null) },
    $queryRaw: jest.fn().mockResolvedValue([{ id: "duplicate-1", distance_meters: 40 }]),
    ...overrides,
  } as any;
}

function buildBroadcasts() {
  return { autoBroadcastVerifiedIncident: jest.fn().mockResolvedValue({ skipped: false }) } as any;
}

function buildNotifications() {
  return { enqueue: jest.fn().mockResolvedValue({ jobId: "job-1" }) } as any;
}

describe("VerificationService", () => {
  it("records verification score and auto-escalates high-confidence P1 incidents", async () => {
    const prisma = buildPrisma();
    const scorer = {
      score: jest.fn().mockReturnValue({
        confidenceScore: 96,
        status: "HighConfidence",
        shouldRequestCrowdConfirmation: false,
        shouldAutoEscalate: true,
        targetSystemVerificationMs: 5000,
        targetCrowdRequestMs: 10000,
        breakdown: { gpsAccuracy: 12, evidenceChainOfCustody: 6 },
      }),
    } as any;
    const broadcasts = buildBroadcasts();
    const service = new VerificationService(prisma, scorer, broadcasts, createMetricsMock(), buildNotifications());

    const result = await service.verifyIncident("incident-1", {}, { typ: "admin", sub: "admin-1" } as any);

    expect(result.confidenceScore).toBe(96);
    expect(result.withinTarget).toBe(true);
    expect(prisma.incidentVerification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ result: "HighConfidence", method: "admin_system_review" }),
    }));
    expect(prisma.incident.update).toHaveBeenCalled();
    expect(broadcasts.autoBroadcastVerifiedIncident).toHaveBeenCalledWith("incident-1", 96);
  });

  it("requests nearby crowd confirmation for uncertain incidents", async () => {
    const prisma = buildPrisma({
      user: { findMany: jest.fn().mockResolvedValue([{ id: "witness-1" }, { id: "witness-2" }]) },
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ id: "duplicate-1", distance_meters: 40 }])
        .mockResolvedValueOnce([{ userId: "witness-1", distanceMeters: 120 }]),
    });
    const scorer = {
      score: jest.fn().mockReturnValue({
        confidenceScore: 55,
        status: "NeedsCrowdConfirmation",
        shouldRequestCrowdConfirmation: true,
        shouldAutoEscalate: false,
        targetSystemVerificationMs: 5000,
        targetCrowdRequestMs: 10000,
        breakdown: { gpsAccuracy: 6 },
      }),
    } as any;
    const notifications = buildNotifications();
    const service = new VerificationService(prisma, scorer, buildBroadcasts(), createMetricsMock(), notifications);

    await service.verifyIncident("incident-1");
    await new Promise((resolve) => setImmediate(resolve));

    expect(prisma.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "witness-1" }),
    }));
    expect(notifications.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      userId: "witness-1",
      incidentId: "incident-1",
    }));
  });

  it("enqueues crowd confirmation notifications through BullMQ", async () => {
    const prisma = buildPrisma({
      user: { findMany: jest.fn().mockResolvedValue([{ id: "witness-1" }]) },
      $queryRaw: jest.fn().mockResolvedValue([{ userId: "witness-1", distanceMeters: 120 }]),
    });
    const notifications = buildNotifications();
    const service = new VerificationService(prisma, {} as any, buildBroadcasts(), createMetricsMock(), notifications);

    await service.requestCrowdConfirmation("incident-1", { limit: 5, radiusMeters: 500 });

    expect(prisma.notification.create).toHaveBeenCalled();
    expect(notifications.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      userId: "witness-1",
      channel: "push",
      incidentId: "incident-1",
    }));
  });

  it("lists witness confirmations for an incident", async () => {
    const prisma = buildPrisma({
      incidentVerification: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "verification-1",
            incidentId: "incident-1",
            verifierId: "witness-1",
            method: "nearby_user_confirmation",
            result: "confirmed",
            confidence: 70,
            notes: "I saw it",
            createdAt: new Date("2026-07-22T00:00:00.000Z"),
            verifier: { email: "witness@example.com", profile: { firstName: "Witness", lastName: "One" } },
          },
        ]),
      },
    });
    const service = new VerificationService(prisma, {} as any, buildBroadcasts(), createMetricsMock(), buildNotifications());

    const result = await service.listWitnessConfirmations("incident-1");

    expect(result.data).toEqual([
      expect.objectContaining({
        id: "verification-1",
        verifierName: "Witness One",
        result: "confirmed",
      }),
    ]);
  });

  it("records admin manual verification reviews", async () => {
    const prisma = buildPrisma();
    const scorer = {
      score: jest.fn().mockReturnValue({
        confidenceScore: 88,
        status: "HighConfidence",
        shouldRequestCrowdConfirmation: false,
        shouldAutoEscalate: false,
        targetSystemVerificationMs: 5000,
        targetCrowdRequestMs: 10000,
        breakdown: { adminConfirmation: 15 },
      }),
    } as any;
    const service = new VerificationService(prisma, scorer, buildBroadcasts(), createMetricsMock(), buildNotifications());

    await service.adminReviewIncident(
      "incident-1",
      { decision: "confirm", note: "Dispatcher confirmed evidence chain." },
      { typ: "admin", sub: "admin-1", role: "Call Center Agent" } as any,
    );

    expect(prisma.incidentVerification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ method: "admin_manual_review", result: "confirmed" }),
    }));
  });
});
