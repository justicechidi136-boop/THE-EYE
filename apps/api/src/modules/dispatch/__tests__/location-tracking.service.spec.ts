import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { IncidentStatus } from "@the-eye/shared";
import { LocationTrackingService } from "../location-tracking.service";

function buildLocationService(overrides: Partial<Record<string, any>> = {}) {
  const prisma = {
    incident: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    incidentLocationUpdate: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    responderLocationUpdate: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    incidentAssignment: {
      findUnique: jest.fn(),
    },
    responder: {
      update: jest.fn(),
    },
    ...(overrides.prisma ?? {}),
  };
  return { service: new LocationTrackingService(prisma as any), prisma };
}

describe("LocationTrackingService", () => {
  const citizen = { sub: "user-1", typ: "user" as const };
  const responderUser = { sub: "resp-user-1", typ: "user" as const, permissions: ["incident:update"] };

  it("rejects invalid coordinates for citizen location", async () => {
    const { service } = buildLocationService();
    await expect(
      service.recordCitizenLocation("inc-1", { latitude: 999, longitude: 3.2 }, citizen as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("enforces citizen ownership on location updates", async () => {
    const { service, prisma } = buildLocationService();
    prisma.incident.findUnique.mockResolvedValue({
      id: "inc-1",
      status: IncidentStatus.Submitted,
      reporterId: "other-user",
    });

    await expect(
      service.recordCitizenLocation("inc-1", { latitude: 6.5, longitude: 3.3 }, citizen as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects out-of-order citizen sequence numbers", async () => {
    const { service, prisma } = buildLocationService();
    prisma.incident.findUnique.mockResolvedValue({
      id: "inc-1",
      status: IncidentStatus.Submitted,
      reporterId: "user-1",
    });
    prisma.incidentLocationUpdate.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ sequenceNumber: 5 });

    await expect(
      service.recordCitizenLocation(
        "inc-1",
        { latitude: 6.5, longitude: 3.3, sequenceNumber: 3 },
        citizen as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns duplicate citizen update idempotently", async () => {
    const duplicate = {
      id: "loc-1",
      latitude: 6.5,
      longitude: 3.3,
      accuracy: 10,
      capturedAt: new Date(),
      sequenceNumber: 2,
    };
    const { service, prisma } = buildLocationService();
    prisma.incident.findUnique.mockResolvedValue({
      id: "inc-1",
      status: IncidentStatus.Submitted,
      reporterId: "user-1",
    });
    prisma.incidentLocationUpdate.findFirst.mockResolvedValue(duplicate);

    const result = await service.recordCitizenLocation(
      "inc-1",
      { latitude: 6.5, longitude: 3.3, sequenceNumber: 2 },
      citizen as any,
    );
    expect(result.sequenceNumber).toBe(2);
    expect(prisma.incidentLocationUpdate.create).not.toHaveBeenCalled();
  });

  it("blocks location streaming for closed incidents", async () => {
    const { service, prisma } = buildLocationService();
    prisma.incident.findUnique.mockResolvedValue({
      id: "inc-1",
      status: IncidentStatus.Resolved,
      reporterId: "user-1",
    });

    await expect(
      service.recordCitizenLocation("inc-1", { latitude: 6.5, longitude: 3.3 }, citizen as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects responder location for another assignment owner", async () => {
    const { service, prisma } = buildLocationService();
    prisma.incidentAssignment.findUnique.mockResolvedValue({
      id: "assign-1",
      responderId: "resp-1",
      agencyId: "agency-1",
      responder: { userId: "other-responder" },
      incident: { id: "inc-1", status: IncidentStatus.Assigned },
    });

    await expect(
      service.recordResponderLocation("assign-1", { latitude: 6.5, longitude: 3.3 }, responderUser as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("throws when incident is missing for live location", async () => {
    const { service, prisma } = buildLocationService();
    prisma.incident.findUnique.mockResolvedValue(null);

    await expect(service.getCitizenLiveLocation("missing", citizen as any)).rejects.toBeInstanceOf(NotFoundException);
  });
});
