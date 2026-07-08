import { IncidentPriority, IncidentStatus } from "@the-eye/shared";
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
    media: [{ id: "media-1" }, { id: "media-2" }, { id: "media-3" }],
    liveVideoSessions: [{ id: "live-1", endedAt: null }],
    reporter: { trustedReporter: { trustScore: 95 } },
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
    notification: { createMany: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([{ id: "duplicate-1", distance_meters: 40 }]),
    ...overrides,
  } as any;
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
        breakdown: { gpsAccuracy: 12 },
      }),
    } as any;
    const service = new VerificationService(prisma, scorer);

    const result = await service.verifyIncident("incident-1", {}, { typ: "admin", sub: "admin-1" } as any);

    expect(result.confidenceScore).toBe(96);
    expect(prisma.incidentVerification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ result: "HighConfidence", method: "admin_system_review" }),
    }));
    expect(prisma.incidentTimeline.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: "incident.verification_scored" }),
    }));
    expect(prisma.incident.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: IncidentStatus.Verified }),
    }));
  });

  it("requests nearby crowd confirmation for uncertain incidents", async () => {
    const prisma = buildPrisma({
      user: { findMany: jest.fn().mockResolvedValue([{ id: "witness-1" }, { id: "witness-2" }]) },
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
    const service = new VerificationService(prisma, scorer);

    await service.verifyIncident("incident-1");
    await new Promise((resolve) => setImmediate(resolve));

    expect(prisma.notification.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([expect.objectContaining({ userId: "witness-1" })]),
    }));
  });
});
