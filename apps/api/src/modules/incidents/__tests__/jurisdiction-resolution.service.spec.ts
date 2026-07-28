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

  it("does not use profile fallback when valid GPS is outside mapped polygons", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.profile.findUnique.mockResolvedValue({
      country: "Nigeria",
      state: "Lagos",
      lga: "Ikeja",
    });
    prisma.jurisdiction.findFirst.mockResolvedValue({
      id: "j-global",
      country: "Nigeria",
      state: "All",
      lga: "All",
    });

    const result = await service.resolve({
      latitude: 4.8156,
      longitude: 7.0498,
      actor: { sub: "user-1", typ: "user", role: "Citizen", permissions: [] },
    });
    expect(result.resolutionStatus).toBe(
      JurisdictionResolutionStatus.AwaitingManualResolution,
    );
    expect(result.resolutionSource).toBe("coordinates_unmapped");
    expect(result.lga).not.toBe("Ikeja");
  });

  it("uses profile fallback only when coordinates are unavailable", async () => {
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
      latitude: 0,
      longitude: 0,
      actor: { sub: "user-1", typ: "user", role: "Citizen", permissions: [] },
    });
    expect(result.resolutionStatus).toBe(
      JurisdictionResolutionStatus.ResolvedByProfileFallback,
    );
    expect(result.resolutionSource).toBe("user_profile");
  });

  it("routes unavailable GPS without profile to manual queue", async () => {
    prisma.profile.findUnique.mockResolvedValue(null);
    prisma.jurisdiction.findFirst.mockResolvedValue({
      id: "j-global",
      country: "Nigeria",
      state: "All",
      lga: "All",
    });

    const result = await service.resolve({ latitude: 0, longitude: 0 });
    expect(result.resolutionStatus).toBe(JurisdictionResolutionStatus.LocationUnavailable);
    expect(result.resolutionSource).toBe("location_unavailable");
  });

  it("routes Port Harcourt coordinates to manual queue when Rivers polygon is missing", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.jurisdiction.findFirst.mockResolvedValue({
      id: "j-global",
      country: "Nigeria",
      state: "All",
      lga: "All",
    });

    const result = await service.resolve({ latitude: 4.8156, longitude: 7.0498 });
    expect(result.resolutionStatus).toBe(
      JurisdictionResolutionStatus.AwaitingManualResolution,
    );
    expect(result.resolutionSource).toBe("coordinates_unmapped");
  });

  it("falls back to manual queue when PostGIS polygon lookup fails", async () => {
    prisma.$queryRaw
      .mockRejectedValueOnce(new Error("function st_covers(geography, geography) does not exist"))
      .mockRejectedValueOnce(new Error("function st_distance(geography, geography) does not exist"));
    prisma.jurisdiction.findFirst.mockResolvedValue({
      id: "j-global",
      country: "Nigeria",
      state: "All",
      lga: "All",
    });

    const result = await service.resolve({ latitude: 6.6018, longitude: 3.3515 });
    expect(result.resolutionStatus).toBe(
      JurisdictionResolutionStatus.AwaitingManualResolution,
    );
    expect(result.resolutionSource).toBe("coordinates_unmapped");
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
    prisma.jurisdiction.findFirst.mockResolvedValue({
      id: "j-global",
      country: "Nigeria",
      state: "All",
      lga: "All",
    });

    const result = await service.resolve({ latitude: 40.7, longitude: -74.0 });
    expect(result.resolutionStatus).toBe(
      JurisdictionResolutionStatus.AwaitingManualResolution,
    );
    expect(result.resolutionSource).toBe("coordinates_unmapped");
  });

  it("skips profile fallback when profile jurisdiction is incomplete", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.profile.findUnique.mockResolvedValue({ country: "Nigeria", state: "", lga: "" });
    prisma.jurisdiction.findFirst.mockResolvedValue({
      id: "j-global",
      country: "Nigeria",
      state: "All",
      lga: "All",
    });

    const result = await service.resolve({
      latitude: 6.6018,
      longitude: 3.3515,
      actor: { sub: "user-1", typ: "user", role: "Citizen", permissions: [] },
    });
    expect(result.resolutionStatus).toBe(
      JurisdictionResolutionStatus.AwaitingManualResolution,
    );
  });
});
