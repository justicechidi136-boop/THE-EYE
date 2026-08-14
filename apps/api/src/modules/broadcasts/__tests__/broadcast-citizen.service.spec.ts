import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { BroadcastAuthorType, BroadcastStatus, BroadcastType } from "@the-eye/shared";
import { BroadcastAdminService } from "../broadcast-admin.service";
import { BroadcastCitizenService } from "../broadcast-citizen.service";
import { BroadcastsService } from "../broadcasts.service";
import { buildBroadcastNotificationMetadata } from "../../notifications/notification-routing.schema";

const reporter = {
  sub: "user-1",
  typ: "user" as const,
  permissions: ["incident:create", "incident:read"],
};

const countryAdmin = {
  sub: "admin-1",
  typ: "admin" as const,
  role: "Country Admin",
  country: "NG",
  state: "Lagos",
  lga: "Ikeja",
  permissions: ["broadcast:create", "broadcast:publish", "community:moderate"],
};

describe("BroadcastCitizenService", () => {
  const prisma = {
    broadcast: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    profile: { findUnique: jest.fn() },
    jurisdiction: { findFirst: jest.fn() },
    broadcastReport: { create: jest.fn() },
    broadcastComment: { create: jest.fn(), findMany: jest.fn() },
    broadcastSighting: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    $executeRawUnsafe: jest.fn(),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  } as any;
  const audit = { record: jest.fn() } as any;
  const notificationsService = { create: jest.fn() } as any;
  const broadcastsService = {} as BroadcastsService;
  const broadcastQueue = { enqueueCountryDelivery: jest.fn().mockResolvedValue({ queued: true }) } as any;
  const lifecycle = { enqueueResolutionNotifications: jest.fn().mockResolvedValue({ queued: true }) } as any;
  const share = { buildSharePayload: jest.fn() } as any;

  const service = new BroadcastCitizenService(prisma, audit, notificationsService, broadcastsService, broadcastQueue, lifecycle, share);

  function resetCitizenMocks() {
    prisma.profile.findUnique.mockResolvedValue({ userId: "user-1", country: "NG", state: "Lagos", lga: "Ikeja" });
    prisma.jurisdiction.findFirst.mockResolvedValue({ id: "jurisdiction-1" });
    prisma.broadcast.findFirst.mock.calls = [];
    prisma.broadcast.create.mock.calls = [];
    prisma.broadcast.update.mock.calls = [];
    prisma.broadcastSighting.findFirst.mock.calls = [];
    prisma.broadcastSighting.findMany.mock.calls = [];
    prisma.broadcastSighting.create.mock.calls = [];
    audit.record.mock.calls = [];
    notificationsService.create.mock.calls = [];
    broadcastQueue.enqueueCountryDelivery.mock.calls = [];
    broadcastQueue.enqueueCountryDelivery.mockResolvedValue({ queued: true });
    lifecycle.enqueueResolutionNotifications.mock.calls = [];
    lifecycle.enqueueResolutionNotifications.mockResolvedValue({ queued: true });
    prisma.broadcast.create.mockResolvedValue({
      id: "broadcast-1",
      type: BroadcastType.MissingPerson,
      title: "Missing person: Ada",
      body: "Body",
      status: BroadcastStatus.Active,
      country: "NG",
      authorType: BroadcastAuthorType.Citizen,
      publishedAt: new Date("2026-08-06T00:00:00.000Z"),
      expiresAt: new Date("2026-09-06T00:00:00.000Z"),
      metadata: {},
      adminVerified: false,
    });
  }

  it("creates missing-person broadcast as Active without admin approval", async () => {
    resetCitizenMocks();
    prisma.broadcast.findFirst.mockResolvedValue(null);
    const result = await service.createMissingPerson(
      {
        clientBroadcastId: "client-1",
        fullName: "Ada Okoye",
        ageOrApproximateAge: "12",
        lastSeenAt: "2026-08-06T10:00:00.000Z",
        lastSeenLatitude: 6.5,
        lastSeenLongitude: 3.4,
        clothingDescription: "Blue dress",
        physicalDescription: "Medium height",
        contactMethod: "in_app",
        reporterRelationship: "Parent",
        consentDeclaration: true,
      },
      reporter,
    );

    expect(result.data.status).toBe(BroadcastStatus.Active);
    expect(result.data.authorLabel).toBe("Citizen Broadcast");
    expect(broadcastQueue.enqueueCountryDelivery).toHaveBeenCalledWith("broadcast-1", "NG", 0);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "broadcast.citizen_created" }),
    );
  });

  it("rejects cross-country citizen broadcast scope", async () => {
    resetCitizenMocks();
    prisma.broadcast.findFirst.mockResolvedValue(null);
    await expect(
      service.createMissingPerson(
        {
          clientBroadcastId: "client-2",
          fullName: "Ada Okoye",
          ageOrApproximateAge: "12",
          lastSeenAt: "2026-08-06T10:00:00.000Z",
          lastSeenLatitude: 6.5,
          lastSeenLongitude: 3.4,
          country: "GH",
          clothingDescription: "Blue dress",
          physicalDescription: "Medium height",
          contactMethod: "in_app",
          reporterRelationship: "Parent",
          consentDeclaration: true,
        },
        reporter,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("returns duplicate idempotent response for same clientBroadcastId", async () => {
    resetCitizenMocks();
    prisma.broadcast.findFirst.mockResolvedValueOnce({
      id: "existing-1",
      type: BroadcastType.MissingPerson,
      title: "Existing",
      body: "Body",
      status: BroadcastStatus.Active,
      authorType: BroadcastAuthorType.Citizen,
      adminVerified: false,
    });
    const result = await service.createMissingPerson(
      {
        clientBroadcastId: "client-dup",
        fullName: "Ada Okoye",
        ageOrApproximateAge: "12",
        lastSeenAt: "2026-08-06T10:00:00.000Z",
        lastSeenLatitude: 6.5,
        lastSeenLongitude: 3.4,
        clothingDescription: "Blue dress",
        physicalDescription: "Medium height",
        contactMethod: "in_app",
        reporterRelationship: "Parent",
        consentDeclaration: true,
      },
      reporter,
    );
    expect(result.duplicate).toBe(true);
    expect(prisma.broadcast.create).not.toHaveBeenCalled();
  });

  it("persists stolen-vehicle source and snapshot metadata", async () => {
    resetCitizenMocks();
    prisma.broadcast.findFirst.mockResolvedValue(null);
    prisma.broadcast.create.mockResolvedValue({
      id: "broadcast-vehicle-1",
      type: BroadcastType.StolenVehicle,
      title: "Stolen vehicle: Honda Civic (***1234)",
      body: "Body",
      status: BroadcastStatus.Active,
      country: "NG",
      authorType: BroadcastAuthorType.Citizen,
      publishedAt: new Date("2026-08-06T00:00:00.000Z"),
      expiresAt: new Date("2026-09-06T00:00:00.000Z"),
      metadata: {},
      adminVerified: false,
    });

    await service.createStolenVehicle(
      {
        clientBroadcastId: "client-vehicle-1",
        vehicleType: "Car",
        make: "Honda",
        model: "Civic",
        year: 2023,
        colour: "Blue",
        registrationNumber: "ABC-1234",
        stolenAt: "2026-08-06T10:00:00.000Z",
        distinguishingFeatures: "Rear bumper dent",
        contactMethod: "in_app",
        vinLastFour: "1A2B",
        metadata: {
          sourceVehicleId: "vehicle-42",
          vehiclePhotoObjectKeys: ["garage/vehicle-42/photo-1.jpg"],
        },
      },
      reporter,
    );

    const createArgs = prisma.broadcast.create.mock.calls[0]?.[0];
    const metadata = createArgs?.data?.metadata;
    expect(metadata?.sourceVehicleId).toBe("vehicle-42");
    expect(metadata?.make).toBe("Honda");
    expect(metadata?.model).toBe("Civic");
    expect(metadata?.year).toBe(2023);
    expect(metadata?.colour).toBe("Blue");
    expect(metadata?.registrationNumber).toBe("ABC-1234");
    expect(metadata?.vinLastFour).toBe("1A2B");
    expect(metadata?.vehiclePhotoObjectKeys).toEqual([
      "garage/vehicle-42/photo-1.jpg",
    ]);
  });

  it("allows author resolve and withdraw", async () => {
    resetCitizenMocks();
    prisma.broadcast.findFirst.mockResolvedValue({
      id: "broadcast-1",
      creatorUserId: "user-1",
      status: BroadcastStatus.Active,
    });
    prisma.broadcast.update.mockResolvedValue({
      id: "broadcast-1",
      type: BroadcastType.MissingPerson,
      status: BroadcastStatus.Resolved,
      authorType: BroadcastAuthorType.Citizen,
      adminVerified: false,
    });
    const resolved = await service.resolve("broadcast-1", {}, reporter);
    expect(resolved.data.status).toBe(BroadcastStatus.Resolved);
    expect(lifecycle.enqueueResolutionNotifications).toHaveBeenCalledWith(
      "broadcast-1",
      "MISSING_PERSON_FOUND",
      reporter,
    );
  });

  it("submits sighting for live broadcast with metadata and owner notification", async () => {
    resetCitizenMocks();
    prisma.broadcast.findFirst.mockResolvedValue({
      id: "broadcast-1",
      status: BroadcastStatus.Active,
      creatorUserId: "owner-1",
      jurisdictionId: "jurisdiction-1",
      country: "NG",
      state: "Lagos",
      lga: "Ikeja",
      metadata: { make: "Toyota", model: "Corolla" },
      incident: { assignedAgencyId: "agency-1" },
    });
    prisma.broadcastSighting.findFirst.mockResolvedValue(null);
    prisma.broadcastSighting.create.mockResolvedValue({ id: "sighting-1" });

    const result = await service.submitSighting(
      "broadcast-1",
      {
        clientSightingId: "s-1",
        observedAt: "2026-08-10T12:00:00.000Z",
        locationMode: "CURRENT_GPS",
        latitude: 6.45,
        longitude: 3.41,
        approximateArea: "Ikeja bus-stop",
        description: "Vehicle passed quickly",
        attachments: [
          {
            mediaType: "image",
            objectKey: "evidence/broadcast-user-1/image-1.jpg",
            bucket: "the-eye",
            contentType: "image/jpeg",
            fileName: "image-1.jpg",
            label: "Photo 1",
            fileHash: "sha256:abc",
            sizeBytes: 2048,
          },
        ],
      },
      reporter,
    );

    expect(result.data.id).toBe("sighting-1");
    const createArgs = prisma.broadcastSighting.create.mock.calls[0]?.[0];
    expect(createArgs.data.metadata.attachments[0]).toEqual(
      expect.objectContaining({
        fileHash: "sha256:abc",
        sizeBytes: 2048,
      }),
    );
    expect(prisma.broadcastSighting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            clientSightingId: "s-1",
            locationMode: "CURRENT_GPS",
            attachments: expect.any(Array),
          }),
        }),
      }),
    );
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "owner-1",
        type: "BroadcastSightingAlert",
        title: "New Sighting Report",
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "broadcast.sighting_authority_routed" }),
    );
  });

  it("rejects sighting submission for non-live broadcasts", async () => {
    resetCitizenMocks();
    prisma.broadcast.findFirst.mockResolvedValue({
      id: "broadcast-1",
      status: BroadcastStatus.Resolved,
      creatorUserId: "owner-1",
    });
    await expect(
      service.submitSighting(
        "broadcast-1",
        {
          locationMode: "NOT_PROVIDED",
          description: "No longer active broadcast",
        },
        reporter,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns idempotent duplicate for same clientSightingId", async () => {
    resetCitizenMocks();
    prisma.broadcast.findFirst.mockResolvedValue({
      id: "broadcast-1",
      status: BroadcastStatus.Active,
      creatorUserId: "owner-1",
      metadata: {},
      incident: null,
    });
    prisma.broadcastSighting.findFirst.mockResolvedValue({ id: "existing-sighting" });

    const result = await service.submitSighting(
      "broadcast-1",
      {
        clientSightingId: "dup-1",
        locationMode: "NOT_PROVIDED",
        description: "Duplicate submit",
      },
      reporter,
    );

    expect(result.duplicate).toBe(true);
    expect(result.data.id).toBe("existing-sighting");
    expect(prisma.broadcastSighting.create).not.toHaveBeenCalled();
  });

  it("redacts private fields for owner while preserving admin visibility", async () => {
    resetCitizenMocks();
    prisma.broadcast.findFirst.mockResolvedValue({
      id: "broadcast-1",
      creatorUserId: "user-1",
    });
    prisma.broadcastSighting.findMany.mockResolvedValue([
      {
        id: "sighting-1",
        reporterUserId: "user-44",
        observedAt: new Date("2026-08-10T12:00:00.000Z"),
        latitude: 6.45,
        longitude: 3.41,
        approximateArea: "Ikeja",
        description: "Seen at market road",
        directionOfTravel: null,
        confidence: null,
        metadata: {
          locationMode: "MANUAL",
          attachments: [{ mediaType: "image", label: "Photo 1", fileName: "1.jpg" }],
        },
      },
    ]);

    const ownerList = await service.listSightings("broadcast-1", reporter);
    expect(ownerList.data[0].reporter).toEqual({ label: "Citizen sighting" });
    expect(ownerList.data[0].latitude).toBeUndefined();
    expect(ownerList.data[0].longitude).toBeUndefined();

    const adminList = await service.listSightings("broadcast-1", countryAdmin);
    expect(adminList.data[0].reporter).toEqual({ reporterUserId: "user-44" });
    expect(adminList.data[0].latitude).toBeDefined();
    expect(adminList.data[0].longitude).toBeDefined();
  });

  it("rejects sightings list for unrelated citizen", async () => {
    resetCitizenMocks();
    prisma.broadcast.findFirst.mockResolvedValue({
      id: "broadcast-1",
      creatorUserId: "owner-1",
    });
    await expect(service.listSightings("broadcast-1", reporter)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("BroadcastAdminService", () => {
  const prisma = {
    broadcast: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    incident: { findUnique: jest.fn() },
    broadcastComment: { create: jest.fn() },
    broadcastReport: { findMany: jest.fn() },
    $executeRawUnsafe: jest.fn(),
  } as any;
  const audit = { record: jest.fn() } as any;
  const broadcastsService = { dispatch: jest.fn() } as any;
  const broadcastQueue = { enqueueCountryDelivery: jest.fn().mockResolvedValue({ queued: true }) } as any;
  const lifecycle = { enqueueResolutionNotifications: jest.fn().mockResolvedValue({ queued: true }) } as any;
  const service = new BroadcastAdminService(prisma, audit, broadcastsService, broadcastQueue, lifecycle);

  function resetAdminMocks() {
    prisma.broadcast.findFirst.mock.calls = [];
    prisma.broadcast.create.mock.calls = [];
    prisma.broadcast.update.mock.calls = [];
    prisma.broadcast.findUnique.mock.calls = [];
    audit.record.mock.calls = [];
    broadcastQueue.enqueueCountryDelivery.mock.calls = [];
    broadcastQueue.enqueueCountryDelivery.mockResolvedValue({ queued: true });
    lifecycle.enqueueResolutionNotifications.mock.calls = [];
    lifecycle.enqueueResolutionNotifications.mockResolvedValue({ queued: true });
    prisma.broadcast.findFirst.mockResolvedValue({
      id: "broadcast-1",
      country: "NG",
      status: BroadcastStatus.Active,
    });
    prisma.broadcast.create.mockResolvedValue({ id: "admin-broadcast-1" });
    prisma.broadcast.findUnique.mockResolvedValue({ id: "admin-broadcast-1", status: BroadcastStatus.Active });
  }

  it("blocks unauthorized admin jurisdiction mutation", async () => {
    resetAdminMocks();
    await expect(
      service.create(
        {
          type: BroadcastType.GovernmentAlert,
          title: "Road closure notice",
          body: "Main road closed until further notice.",
          priority: "P2ActiveCrimeAccident" as never,
          country: "GH",
          jurisdictionId: "jurisdiction-gh",
        },
        countryAdmin,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("suspends and restores broadcasts", async () => {
    resetAdminMocks();
    prisma.broadcast.update.mockResolvedValueOnce({ id: "broadcast-1", status: BroadcastStatus.Suspended });
    const suspended = await service.suspend("broadcast-1", countryAdmin, { reason: "Abuse report" });
    expect(suspended.data.status).toBe(BroadcastStatus.Suspended);
    expect(lifecycle.enqueueResolutionNotifications).toHaveBeenCalledWith(
      "broadcast-1",
      "BROADCAST_SUSPENDED",
      countryAdmin,
    );

    prisma.broadcast.findFirst.mockResolvedValue({ id: "broadcast-1", status: BroadcastStatus.Suspended, country: "NG" });
    prisma.broadcast.update.mockResolvedValueOnce({ id: "broadcast-1", status: BroadcastStatus.Active });
    const restored = await service.restore("broadcast-1", countryAdmin);
    expect(restored.data.status).toBe(BroadcastStatus.Active);
    expect(lifecycle.enqueueResolutionNotifications).toHaveBeenCalledWith(
      "broadcast-1",
      "BROADCAST_RESTORED",
      countryAdmin,
    );
  });

  it("soft deletes while preserving audit trail", async () => {
    resetAdminMocks();
    prisma.broadcast.update.mockResolvedValue({ id: "broadcast-1", status: BroadcastStatus.DeletedByAdmin });
    const deleted = await service.softDelete("broadcast-1", countryAdmin, { reason: "Fraudulent content" });
    expect(deleted.data.status).toBe(BroadcastStatus.DeletedByAdmin);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "broadcast.deleted_by_admin" }),
    );
  });
});

describe("Broadcast notification routing", () => {
  it("excludes sensitive personal data from push metadata", () => {
    const metadata = buildBroadcastNotificationMetadata({
      broadcastId: "broadcast-1",
      broadcastCategory: "MissingPerson",
      countryCode: "NG",
      issuedAt: "2026-08-06T10:00:00.000Z",
      eventType: "MISSING_PERSON_BROADCAST",
    });
    expect(metadata.schemaVersion).toBe(1);
    expect(metadata.routeType).toBe("BROADCAST_DETAILS");
    expect(metadata.eventType).toBe("MISSING_PERSON_BROADCAST");
    expect(metadata.broadcastId).toBe("broadcast-1");
    expect(metadata.deepLink).toBe("/broadcasts/broadcast-1");
    expect(JSON.stringify(metadata)).not.toContain("fullName");
    expect(JSON.stringify(metadata)).not.toContain("registrationNumber");
  });
});

describe("Citizen broadcast validation", () => {
  it("requires consent declaration", async () => {
    const { validateMissingPersonBroadcastDto } = await import("../dto/citizen-broadcast.dto");
    expect(() =>
      validateMissingPersonBroadcastDto({
        clientBroadcastId: "client-1",
        fullName: "Ada",
        ageOrApproximateAge: "10",
        lastSeenAt: "2026-08-06T10:00:00.000Z",
        lastSeenLatitude: 6.5,
        lastSeenLongitude: 3.4,
        clothingDescription: "Blue",
        physicalDescription: "Tall",
        contactMethod: "in_app",
        reporterRelationship: "Parent",
        consentDeclaration: false,
      }),
    ).toThrow(BadRequestException);
  });
});
