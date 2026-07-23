import { BadRequestException } from "@nestjs/common";
import {
  JurisdictionResolutionService,
  JurisdictionResolutionStatus,
} from "../jurisdiction-resolution.service";

describe("JurisdictionResolutionService", () => {
  const prisma = {
    $queryRaw: jest.fn(),
    jurisdiction: { findFirst: jest.fn() },
    profile: { findUnique: jest.fn() },
  };

  const service = new JurisdictionResolutionService(prisma as never);

  it("rejects invalid coordinates as not valid", () => {
    expect(service.isValidCoordinate(0, 0)).toBe(false);
    expect(service.isValidCoordinate(91, 0)).toBe(false);
    expect(service.isValidCoordinate(6.6, 3.35)).toBe(true);
  });

  it("resolves by polygon match first", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      { id: "j1", country: "Nigeria", state: "Lagos", lga: "Ikeja" },
    ]);

    const result = await service.resolve({ latitude: 6.6018, longitude: 3.3515 });
    expect(result.resolutionStatus).toBe(JurisdictionResolutionStatus.ResolvedByCoordinates);
    expect(result.lga).toBe("Ikeja");
  });

  it("falls back to nearest boundary within tolerance", async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "j2",
          country: "Nigeria",
          state: "Lagos",
          lga: "Ikeja",
          distance_meters: 1200,
        },
      ]);

    const result = await service.resolve({ latitude: 6.61, longitude: 3.36 });
    expect(result.resolutionStatus).toBe(JurisdictionResolutionStatus.ResolvedByNearestBoundary);
    expect(result.distanceMeters).toBe(1200);
  });

  it("uses profile fallback when polygon lookup misses", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.profile.findUnique.mockResolvedValue({
      country: "Nigeria",
      state: "Lagos",
      lga: "Ikeja",
    });
    prisma.jurisdiction.findFirst.mockResolvedValue({
      id: "j3",
      country: "Nigeria",
      state: "Lagos",
      lga: "Ikeja",
    });

    const result = await service.resolve({
      latitude: 6.6018,
      longitude: 3.3515,
      actor: { sub: "user-1", typ: "user", role: "Citizen", permissions: [] },
    });
    expect(result.resolutionStatus).toBe(JurisdictionResolutionStatus.ResolvedByProfileFallback);
  });

  it("uses default hierarchy when coordinates are unavailable", async () => {
    prisma.profile.findUnique.mockResolvedValue(null);
    prisma.jurisdiction.findFirst.mockResolvedValue({
      id: "j4",
      country: "Nigeria",
      state: "Lagos",
      lga: "Ikeja",
    });

    const result = await service.resolve({ latitude: 0, longitude: 0 });
    expect(result.resolutionStatus).toBe(JurisdictionResolutionStatus.LocationUnavailable);
    expect(result.resolutionSource).toBe("default_hierarchy");
  });

  it("routes to manual resolution queue when only generic jurisdiction exists", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.profile.findUnique.mockResolvedValue(null);
    prisma.jurisdiction.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "j-global",
        country: "Nigeria",
        state: "All",
        lga: "All",
      });

    const result = await service.resolve({ latitude: 40.7, longitude: -74.0 });
    expect(result.resolutionStatus).toBe(JurisdictionResolutionStatus.AwaitingManualResolution);
    expect(result.resolutionSource).toBe("global_unassigned_queue");
  });

  it("throws only when jurisdiction table is empty", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.profile.findUnique.mockResolvedValue(null);
    prisma.jurisdiction.findFirst.mockResolvedValue(null);

    await expect(service.resolve({ latitude: 6.6, longitude: 3.35 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("ignores nearest boundary beyond approved tolerance", async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "j-far",
          country: "Nigeria",
          state: "Lagos",
          lga: "Ikeja",
          distance_meters: 150_000,
        },
      ]);
    prisma.profile.findUnique.mockResolvedValue(null);
    prisma.jurisdiction.findFirst.mockResolvedValue({
      id: "j4",
      country: "Nigeria",
      state: "Lagos",
      lga: "Ikeja",
    });

    const result = await service.resolve({ latitude: 40.7, longitude: -74.0 });
    expect(result.resolutionStatus).toBe(JurisdictionResolutionStatus.OutsideSupportedJurisdiction);
    expect(result.resolutionSource).toBe("default_hierarchy");
  });

  it("skips profile fallback when profile jurisdiction is incomplete", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.profile.findUnique.mockResolvedValue({ country: "Nigeria", state: "", lga: "" });
    prisma.jurisdiction.findFirst.mockResolvedValue({
      id: "j4",
      country: "Nigeria",
      state: "Lagos",
      lga: "Ikeja",
    });

    const result = await service.resolve({
      latitude: 6.6018,
      longitude: 3.3515,
      actor: { sub: "user-1", typ: "user", role: "Citizen", permissions: [] },
    });
    expect(result.resolutionStatus).toBe(JurisdictionResolutionStatus.OutsideSupportedJurisdiction);
  });
});
