import { ConflictException, ForbiddenException } from "@nestjs/common";
import { AdminRoleName } from "@the-eye/shared";
import { PoliceStationsService } from "../police-stations.service";

function buildService() {
  const prisma = {
    policeStation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    jurisdiction: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
  };

  const auditService = { record: jest.fn() };
  const jurisdictionResolution = { resolve: jest.fn() };

  const service = new PoliceStationsService(
    prisma as never,
    auditService as never,
    jurisdictionResolution as never,
  );

  return { service, prisma, auditService, jurisdictionResolution };
}

describe("PoliceStationsService admin workflow", () => {
  const actor = {
    sub: "admin-1",
    typ: "admin" as const,
    role: AdminRoleName.SuperAdmin,
    country: "Nigeria",
    state: "Lagos",
  };

  it("creates an unverified station with mandatory source metadata", async () => {
    const { service, prisma, auditService, jurisdictionResolution } = buildService();
    prisma.jurisdiction.findFirst.mockResolvedValue({
      id: "jurisdiction-1",
      country: "Nigeria",
      state: "Lagos",
      lga: "Ikeja",
    });
    prisma.jurisdiction.findUnique.mockResolvedValue({
      id: "jurisdiction-1",
      country: "Nigeria",
      state: "Lagos",
      lga: "Ikeja",
    });
    jurisdictionResolution.resolve.mockResolvedValue({
      id: "jurisdiction-1",
      country: "Nigeria",
      state: "Lagos",
      lga: "Ikeja",
    });
    prisma.policeStation.findMany.mockResolvedValue([]);
    prisma.policeStation.create.mockResolvedValue({
      id: "station-1",
      name: "Ikeja Central Police Station",
      jurisdictionId: "jurisdiction-1",
      verificationStatus: "Unverified",
      isActive: true,
      latitude: 6.6018,
      longitude: 3.3515,
    });

    const result = await service.create(
      {
        name: "Ikeja Central Police Station",
        address: "123 Allen Avenue, Ikeja",
        agencyType: "police",
        latitude: 6.6018,
        longitude: 3.3515,
        country: "Nigeria",
        state: "Lagos",
        lga: "Ikeja",
        source: "Admin intake",
        sourceReference: "QA ticket PS-001",
        officialPhone: "08012345678",
      },
      actor,
    );

    expect(result.data.id).toBe("station-1");
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: "police_station.created" }));
  });

  it("rejects create when duplicates exist without override reason", async () => {
    const { service, prisma, jurisdictionResolution } = buildService();
    prisma.jurisdiction.findUnique.mockResolvedValue({
      id: "jurisdiction-1",
      country: "Nigeria",
      state: "Lagos",
      lga: "Ikeja",
    });
    jurisdictionResolution.resolve.mockResolvedValue({
      id: "jurisdiction-1",
      country: "Nigeria",
      state: "Lagos",
      lga: "Ikeja",
    });
    prisma.policeStation.findMany.mockResolvedValue([
      {
        id: "dup-1",
        name: "Ikeja Central Police Station",
        address: "123 Allen Avenue, Ikeja",
        verificationStatus: "VerifiedOfficial",
        latitude: 6.6018,
        longitude: 3.3515,
        googlePlaceId: null,
        sourceReference: "OTHER",
        officialPhone: null,
        emergencyPhone: null,
        phone: null,
      },
    ]);

    await expect(
      service.create(
        {
          name: "Ikeja Central Police Station",
          address: "123 Allen Avenue, Ikeja",
          agencyType: "police",
          latitude: 6.6018,
          longitude: 3.3515,
          source: "Admin intake",
          sourceReference: "QA ticket PS-001",
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("blocks state admin from reading out-of-scope station", async () => {
    const { service, prisma } = buildService();
    prisma.policeStation.findUnique.mockResolvedValue({
      id: "station-1",
      jurisdiction: { id: "j2", country: "Nigeria", state: "Abuja", lga: "Municipal" },
    });

    await expect(
      service.getById("station-1", {
        sub: "state-admin",
        typ: "admin",
        role: AdminRoleName.StateAdmin,
        country: "Nigeria",
        state: "Lagos",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
