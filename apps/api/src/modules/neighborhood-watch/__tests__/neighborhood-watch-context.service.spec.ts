import { NeighborhoodWatchContextService } from "../neighborhood-watch-context.service";

describe("NeighborhoodWatchContextService", () => {
  const audit = { record: jest.fn() };
  const prisma = {
    communityPresence: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
    communityMembership: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    communityAlert: { count: jest.fn().mockResolvedValue(1) },
    communityPost: { count: jest.fn().mockResolvedValue(0) },
    communityPinnedSafetyInfo: { findMany: jest.fn().mockResolvedValue([]) },
    profile: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    $queryRawUnsafe: jest.fn(),
  };

  const service = new NeighborhoodWatchContextService(prisma as any, audit as any);
  const citizen = { typ: "user", sub: "11111111-1111-4111-8111-111111111111" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns LOCATION_REQUIRED when coords missing", async () => {
    const result = await service.resolveContext(citizen as any, {});
    expect(result.locationStatus).toBe("LOCATION_REQUIRED");
    expect(result.publicCommunity).toBeNull();
  });

  it("returns LOCATION_STALE for old capturedAt", async () => {
    const result = await service.resolveContext(citizen as any, {
      lat: "6.45",
      lng: "3.39",
      accuracy: "20",
      capturedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    });
    expect(result.locationStatus).toBe("LOCATION_STALE");
  });

  it("returns LOCATION_LOW_ACCURACY when accuracy is poor", async () => {
    const result = await service.resolveContext(citizen as any, {
      lat: "6.45",
      lng: "3.39",
      accuracy: "250",
      capturedAt: new Date().toISOString(),
    });
    expect(result.locationStatus).toBe("LOCATION_LOW_ACCURACY");
  });

  it("returns CONFIRMED with presence for a public community", async () => {
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Trans-Amadi",
          visibility: "Public",
          status: "Active",
          country: "NG",
          state: "Rivers",
          lga: "Port Harcourt",
          description: "Public safety zone",
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.communityPresence.findFirst.mockResolvedValue(null);
    prisma.communityPresence.upsert.mockResolvedValue({});
    prisma.communityMembership.findUnique.mockResolvedValue(null);

    const result = await service.resolveContext(citizen as any, {
      lat: "4.8156",
      lng: "7.0498",
      accuracy: "25",
      capturedAt: new Date().toISOString(),
    });

    expect(result.locationStatus).toBe("CONFIRMED");
    expect(result.publicCommunity?.name).toBe("Trans-Amadi");
    expect(result.presence?.mode).toBe("LOCATION_PARTICIPANT");
    expect(result.permissions.canViewPublicFeed).toBe(true);
    expect(prisma.communityPresence.upsert).toHaveBeenCalled();
  });
});
