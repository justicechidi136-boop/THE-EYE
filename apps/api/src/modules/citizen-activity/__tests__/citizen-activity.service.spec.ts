import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { BroadcastStatus, BroadcastType, IncidentStatus, IncidentType } from "@the-eye/shared";
import { CitizenActivityService } from "../citizen-activity.service";

function buildService(overrides: Partial<Record<string, unknown>> = {}) {
  const prisma = {
    incident: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
    broadcast: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
    notification: { groupBy: jest.fn().mockResolvedValue([]) },
    auditLog: { count: jest.fn().mockResolvedValue(0) },
    liveVideoSession: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ count: 0n }]),
    ...(overrides.prisma as object),
  };
  const incidentTimeline = {
    buildTimeline: jest.fn().mockResolvedValue({ data: [{ at: "2026-08-01T10:00:00.000Z", type: "report.submitted", label: "Submitted" }] }),
    ...(overrides.incidentTimeline as object),
  };
  const communityVerification = {
    getIncidentAggregate: jest.fn().mockResolvedValue({
      requestsSent: 2,
      responsesReceived: 1,
      confirmedCount: 1,
      safeSummaryText: "Community verification is in progress.",
    }),
    ...(overrides.communityVerification as object),
  };
  return {
    service: new CitizenActivityService(prisma as any, incidentTimeline as any, communityVerification as any),
    prisma,
    incidentTimeline,
    communityVerification,
  };
}

describe("CitizenActivityService", () => {
  const citizen = { typ: "user", sub: "user-1", permissions: ["incident:read"] } as const;

  it("rejects non-citizen actors", async () => {
    const { service } = buildService();
    await expect(service.listActivityHistory({ typ: "admin", sub: "admin-1" } as any, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("merges incidents and broadcasts with section filtering", async () => {
    const submittedAt = new Date("2026-08-01T09:00:00.000Z");
    const createdAt = new Date("2026-08-01T08:00:00.000Z");
    const { service, prisma } = buildService();
    prisma.incident.findMany.mockResolvedValue([
      {
        id: "inc-1",
        type: IncidentType.Emergency,
        status: IncidentStatus.Responding,
        title: "Emergency",
        submittedAt,
        metadata: { intake: "emergency_fast_path" },
        address: "Lagos",
        latitude: 6.5,
        longitude: 3.3,
        assignedAgency: { name: "Police" },
        verifications: [{ result: "confirm", confidence: 88 }],
        media: [],
      },
    ]);
    prisma.broadcast.findMany.mockResolvedValue([
      {
        id: "bc-1",
        type: BroadcastType.MissingPerson,
        status: BroadcastStatus.Active,
        title: "Missing person",
        createdAt,
        publishedAt: createdAt,
        country: "NG",
        metadata: { fullName: "Ada" },
        adminVerified: true,
        resolvedAt: null,
        withdrawnAt: null,
        _count: { deliveries: 120, comments: 3, reads: 40 },
      },
    ]);

    const all = await service.listActivityHistory(citizen as any, { section: "All" });
    expect(all.data).toHaveLength(2);
    expect(all.data[0]?.id).toBe("inc-1");
    expect(all.data[1]?.kind).toBe("MissingPersonBroadcast");

    const broadcastsOnly = await service.listActivityHistory(citizen as any, { section: "Broadcasts" });
    expect(broadcastsOnly.data).toHaveLength(1);
    expect(broadcastsOnly.data[0]?.navigation.destination).toBe("broadcast-archive");
  });

  it("supports search by missing person name and vehicle plate", async () => {
    const { service, prisma } = buildService();
    prisma.incident.findMany.mockResolvedValue([]);
    prisma.broadcast.findMany.mockResolvedValue([
      {
        id: "bc-mp",
        type: BroadcastType.MissingPerson,
        status: BroadcastStatus.Active,
        title: "Missing person",
        createdAt: new Date("2026-08-01T08:00:00.000Z"),
        publishedAt: new Date("2026-08-01T08:00:00.000Z"),
        metadata: { fullName: "Ada Okoro" },
        adminVerified: false,
        resolvedAt: null,
        withdrawnAt: null,
        _count: { deliveries: 1, comments: 0, reads: 0 },
      },
      {
        id: "bc-sv",
        type: BroadcastType.StolenVehicle,
        status: BroadcastStatus.Active,
        title: "Stolen vehicle",
        createdAt: new Date("2026-08-01T07:00:00.000Z"),
        publishedAt: new Date("2026-08-01T07:00:00.000Z"),
        metadata: { registrationMasked: "ABC-***" },
        adminVerified: false,
        resolvedAt: null,
        withdrawnAt: null,
        _count: { deliveries: 1, comments: 0, reads: 0 },
      },
    ]);

    const missing = await service.listActivityHistory(citizen as any, { q: "ada" });
    expect(missing.data).toHaveLength(1);
    expect(missing.data[0]?.id).toBe("bc-mp");

    const vehicle = await service.listActivityHistory(citizen as any, { q: "abc" });
    expect(vehicle.data).toHaveLength(1);
    expect(vehicle.data[0]?.id).toBe("bc-sv");
  });

  it("paginates merged activity history", async () => {
    const { service, prisma } = buildService();
    prisma.incident.findMany.mockResolvedValue(
      Array.from({ length: 3 }).map((_, index) => ({
        id: `inc-${index}`,
        type: IncidentType.Crime,
        status: IncidentStatus.Submitted,
        title: `Incident ${index}`,
        submittedAt: new Date(`2026-08-0${index + 1}T10:00:00.000Z`),
        metadata: {},
        address: null,
        latitude: null,
        longitude: null,
        assignedAgency: null,
        verifications: [],
        media: [],
      })),
    );
    prisma.broadcast.findMany.mockResolvedValue([]);

    const page1 = await service.listActivityHistory(citizen as any, { limit: "2" });
    expect(page1.data).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).not.toBe(null);

    const page2 = await service.listActivityHistory(citizen as any, {
      limit: "2",
      cursor: page1.nextCursor ?? undefined,
    });
    expect(page2.data).toHaveLength(1);
    expect(page2.hasMore).toBe(false);
  });

  it("lists ended live emergencies separately from active and resolved reports", async () => {
    const { service, prisma } = buildService();
    prisma.incident.findMany.mockResolvedValue([
      {
        id: "inc-ended",
        type: IncidentType.Emergency,
        status: IncidentStatus.Ended,
        title: "Ended live emergency",
        submittedAt: new Date("2026-08-01T10:00:00.000Z"),
        metadata: { source: "live_emergency_video" },
        address: "Market Road",
        latitude: 6.5,
        longitude: 3.3,
        assignedAgency: null,
        verifications: [],
        media: [],
      },
    ]);

    const ended = await service.listActivityHistory(citizen as any, {
      section: "Ended",
    });
    const active = await service.listActivityHistory(citizen as any, {
      section: "Active",
    });
    const resolved = await service.listActivityHistory(citizen as any, {
      section: "Resolved",
    });

    expect(ended.data).toHaveLength(1);
    expect(ended.data[0]).toEqual(
      expect.objectContaining({
        id: "inc-ended",
        lifecycle: "ended",
        isActive: false,
        isTerminal: true,
        navigation: expect.objectContaining({ destination: "incident-archive" }),
      }),
    );
    expect(active.data).toHaveLength(0);
    expect(resolved.data).toHaveLength(0);
  });

  it("rejects invalid section and cursor values", async () => {
    const { service } = buildService();
    await expect(service.listActivityHistory(citizen as any, { section: "Invalid" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.listActivityHistory(citizen as any, { cursor: "bad-cursor" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("returns incident archive only for the reporting citizen", async () => {
    const { service, prisma } = buildService();
    prisma.incident.findFirst.mockResolvedValue({
      id: "inc-1",
      type: IncidentType.Emergency,
      status: IncidentStatus.Resolved,
      title: "Resolved emergency",
      description: "Details",
      submittedAt: new Date("2026-08-01T09:00:00.000Z"),
      resolvedAt: new Date("2026-08-01T11:00:00.000Z"),
      closedAt: null,
      cancelledAt: null,
      metadata: {
        locationAccuracyMeters: 17.4,
        locationCapturedAt: "2026-08-01T08:59:30.000Z",
      },
      address: "Lagos",
      manualAddress: null,
      latitude: 6.5,
      longitude: 3.3,
      manualLatitude: null,
      manualLongitude: null,
      lga: "Ikeja",
      state: "Lagos",
      country: "NG",
      isAnonymous: false,
      resolutionSource: "Reporter",
      resolutionReason: "Safe now",
      assignedAgency: { name: "Police" },
      reporter: { profile: { firstName: "Ada", lastName: "Okoro" } },
      media: [
        {
          id: "media-1",
          mediaType: "Image",
          capturedAt: new Date("2026-08-01T09:01:00.000Z"),
          uploadedAt: new Date("2026-08-01T09:02:00.000Z"),
          contentType: "image/jpeg",
          durationSeconds: null,
          fileHash: "internal-hash",
          sizeBytes: null,
          transcript: null,
        },
      ],
      verifications: [],
      broadcasts: [],
      notifications: [],
      assignments: [],
    });

    const archive = await service.getIncidentArchive("inc-1", citizen as any);
    expect(archive.data.readOnly).toBe(true);
    expect(archive.data.incidentId).toBe("inc-1");
    expect(archive.data.publicReference).toBe("EYE-260801-INC1");
    expect(archive.data.verificationStatus).toBe("Not verified");
    expect(archive.data.location.accuracyMeters).toBe(17.4);
    expect(archive.data.location.capturedAt).toBe(
      "2026-08-01T08:59:30.000Z",
    );
    expect(archive.data.communityVerificationSummary.safeSummaryText).toBe(
      "Community verification is complete for this resolved incident.",
    );
    expect(archive.data.evidenceGallery[0].fileHash).toBeUndefined();
    expect(archive.data.auditSummary).toBeUndefined();
    expect(archive.data.notificationsSent).toBeUndefined();
    expect(archive.data.communityVerificationSummary.requestsSent).toBe(2);
    expect(prisma.incident.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "inc-1", reporterId: "user-1" } }),
    );
  });

  it("returns ended incident archive copy without claiming resolution", async () => {
    const { service, prisma } = buildService();
    prisma.incident.findFirst.mockResolvedValue({
      id: "inc-ended",
      type: IncidentType.Emergency,
      status: IncidentStatus.Ended,
      title: "Live emergency video",
      description: null,
      submittedAt: new Date("2026-08-01T09:00:00.000Z"),
      endedAt: new Date("2026-08-01T09:05:00.000Z"),
      resolvedAt: null,
      closedAt: null,
      cancelledAt: null,
      metadata: { source: "live_emergency_video" },
      address: "Market Road",
      manualAddress: null,
      latitude: 6.5,
      longitude: 3.3,
      manualLatitude: null,
      manualLongitude: null,
      lga: "Ikeja",
      state: "Lagos",
      country: "NG",
      isAnonymous: false,
      resolutionSource: null,
      resolutionReason: null,
      assignedAgency: null,
      reporter: { profile: { firstName: "Ada", lastName: "Okoro" } },
      media: [],
      verifications: [],
      broadcasts: [],
      assignments: [],
    });

    const archive = await service.getIncidentArchive("inc-ended", citizen as any);

    expect(archive.data.status).toBe(IncidentStatus.Ended);
    expect(archive.data.endedAt).toBe("2026-08-01T09:05:00.000Z");
    expect(archive.data.resolvedAt).toBe(null);
    expect(archive.data.communityVerificationSummary.safeSummaryText).toBe(
      "Community verification is complete for this incident.",
    );
  });

  it("does not expose another citizen's incident archive", async () => {
    const { service, prisma } = buildService();
    prisma.incident.findFirst.mockResolvedValue(null);
    await expect(service.getIncidentArchive("inc-secret", citizen as any)).rejects.toThrow("Incident archive not found");
  });

  it("returns broadcast archive only for the creator", async () => {
    const { service, prisma } = buildService();
    prisma.broadcast.findFirst.mockResolvedValue({
      id: "bc-1",
      type: BroadcastType.StolenVehicle,
      title: "Stolen vehicle",
      body: "Blue sedan",
      createdAt: new Date("2026-08-01T08:00:00.000Z"),
      publishedAt: new Date("2026-08-01T08:00:00.000Z"),
      status: BroadcastStatus.Active,
      adminVerified: false,
      verifiedAt: null,
      resolvedAt: null,
      withdrawnAt: null,
      suspendedReason: null,
      country: "NG",
      metadata: { make: "Toyota", model: "Camry", registrationMasked: "ABC-***" },
      comments: [],
      _count: { comments: 0, deliveries: 10, reads: 4, sightings: 1, reports: 0 },
    });

    const archive = await service.getBroadcastArchive("bc-1", citizen as any);
    expect(archive.data.readOnly).toBe(true);
    expect(archive.data.stolenVehicle?.make).toBe("Toyota");
    expect(archive.data.reach).toBe(10);
  });
});
