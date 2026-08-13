import { NeighborhoodWatchContextService } from "../neighborhood-watch-context.service";

describe("NeighborhoodWatchContextService", () => {
  const audit = { record: jest.fn() };
  const jurisdictionResolution = {
    diagnose: jest.fn(),
  };

  const prisma = {
    communityPresence: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
    nwDynamicAreaPresence: {
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

  const citizen = { typ: "user", sub: "11111111-1111-4111-8111-111111111111" };

  function buildService() {
    return new NeighborhoodWatchContextService(
      prisma as any,
      audit as any,
      jurisdictionResolution as any,
    );
  }

  it("returns LOCATION_REQUIRED when coords missing", async () => {
    const result = await buildService().resolveContext(citizen as any, {});
    expect(result.locationStatus).toBe("LOCATION_REQUIRED");
    expect(result.contextType).toBe("LOCATION_REQUIRED");
    expect(result.publicCommunity).toBe(null);
    expect(result.dynamicArea).toBe(null);
    expect(result.permissions.canPost).toBe(false);
  });

  it("returns LOCATION_STALE for old capturedAt", async () => {
    const result = await buildService().resolveContext(citizen as any, {
      lat: "6.45",
      lng: "3.39",
      accuracy: "20",
      capturedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    });
    expect(result.locationStatus).toBe("LOCATION_STALE");
    expect(result.contextType).toBe("LOCATION_STALE");
    expect(result.permissions.canPost).toBe(false);
  });

  it("returns LOCATION_LOW_ACCURACY when accuracy is poor", async () => {
    const result = await buildService().resolveContext(citizen as any, {
      lat: "6.45",
      lng: "3.39",
      accuracy: "250",
      capturedAt: new Date().toISOString(),
    });
    expect(result.locationStatus).toBe("LOCATION_LOW_ACCURACY");
    expect(result.contextType).toBe("LOCATION_LOW_ACCURACY");
  });

  it("returns MAPPED_PUBLIC_COMMUNITY when a public community contains the point", async () => {
    prisma.$queryRawUnsafe = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Trans-Amadi",
          visibility: "Public",
          status: "Active",
          country: "Nigeria",
          state: "Rivers",
          lga: "Port Harcourt",
          description: "Public safety zone",
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.communityPresence.findFirst = jest.fn().mockResolvedValue(null);
    prisma.communityPresence.upsert = jest.fn().mockResolvedValue({});
    prisma.communityMembership.findUnique = jest.fn().mockResolvedValue(null);
    prisma.communityAlert.count = jest.fn().mockResolvedValue(1);

    const result = await buildService().resolveContext(citizen as any, {
      lat: "4.8156",
      lng: "7.0498",
      accuracy: "25",
      capturedAt: new Date().toISOString(),
    });

    expect(result.locationStatus).toBe("CONFIRMED");
    expect(result.contextType).toBe("MAPPED_PUBLIC_COMMUNITY");
    expect(result.publicCommunity?.name).toBe("Trans-Amadi");
    expect(result.dynamicArea).toBe(null);
    expect(result.presence?.mode).toBe("LOCATION_PARTICIPANT");
    expect(result.permissions.canPost).toBe(true);
    expect(prisma.communityPresence.upsert).toHaveBeenCalled();
  });

  it("returns DYNAMIC_PUBLIC_AREA when GPS is valid but no mapped public community exists", async () => {
    let dynamicUpserts = 0;
    let communityUpserts = 0;
    prisma.$queryRawUnsafe = jest.fn().mockResolvedValue([]);
    jurisdictionResolution.diagnose = jest.fn().mockResolvedValue({
      polygonMatch: { id: "j1", country: "Nigeria", state: "Rivers", lga: "Obio-Akpor" },
      nearestMatch: null,
    });
    prisma.nwDynamicAreaPresence.findFirst = jest.fn().mockResolvedValue(null);
    prisma.nwDynamicAreaPresence.upsert = jest.fn().mockImplementation(async () => {
      dynamicUpserts += 1;
      return {};
    });
    prisma.communityPresence.upsert = jest.fn().mockImplementation(async () => {
      communityUpserts += 1;
      return {};
    });
    prisma.communityMembership.findMany = jest.fn().mockResolvedValue([]);
    prisma.communityPost.count = jest.fn().mockResolvedValue(0);
    prisma.profile.findUnique = jest.fn().mockResolvedValue(null);
    audit.record = jest.fn().mockResolvedValue(undefined);

    const result = await buildService().resolveContext(citizen as any, {
      lat: "4.8472",
      lng: "7.0074",
      accuracy: "20",
      capturedAt: new Date().toISOString(),
    });

    expect(result.locationStatus).toBe("CONFIRMED");
    expect(result.contextType).toBe("DYNAMIC_PUBLIC_AREA");
    expect(result.publicCommunity).toBe(null);
    expect(result.dynamicArea?.areaKey).toBe("da:NIGERIA:RIVERS:OBIO_AKPOR");
    expect(result.dynamicArea?.areaLabel).toContain("Obio-Akpor");
    expect(result.permissions.canPost).toBe(true);
    expect(result.permissions.canShareSecurityTip).toBe(true);
    expect(result.presence?.mode).toBe("DYNAMIC_AREA_PARTICIPANT");
    expect(dynamicUpserts).toBe(1);
    expect(communityUpserts).toBe(0);
  });

  it("keeps private communities nearby alongside Dynamic Public Area", async () => {
    prisma.$queryRawUnsafe = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "priv-1", name: "Green Valley Estate", distance_m: 220 }]);
    jurisdictionResolution.diagnose.mockResolvedValue({
      polygonMatch: null,
      nearestMatch: { id: "j2", country: "Nigeria", state: "Enugu", lga: "Enugu North", distanceMeters: 400 },
    });
    prisma.nwDynamicAreaPresence.findFirst = jest.fn().mockResolvedValue(null);
    prisma.nwDynamicAreaPresence.upsert = jest.fn().mockResolvedValue({});
    prisma.communityMembership.findMany = jest.fn().mockResolvedValue([]);

    const result = await buildService().resolveContext(citizen as any, {
      lat: "6.45",
      lng: "7.5",
      accuracy: "15",
      capturedAt: new Date().toISOString(),
    });

    expect(result.contextType).toBe("DYNAMIC_PUBLIC_AREA");
    expect(result.privateCommunitiesNearby).toHaveLength(1);
    expect(result.privateCommunitiesNearby[0].name).toBe("Green Valley Estate");
    expect(result.permissions.canPost).toBe(true);
    expect(result.permissions.canViewPrivateFeed).toBe(false);
  });

  it("does not use profile jurisdiction when resolving Dynamic Public Area", async () => {
    prisma.$queryRawUnsafe = jest.fn().mockResolvedValue([]);
    jurisdictionResolution.diagnose.mockResolvedValue({
      polygonMatch: null,
      nearestMatch: null,
      profileFallback: { id: "profile-j", country: "Nigeria", state: "Lagos", lga: "Ikeja" },
    });
    prisma.nwDynamicAreaPresence.findFirst = jest.fn().mockResolvedValue(null);
    prisma.nwDynamicAreaPresence.upsert = jest.fn().mockResolvedValue({});

    const result = await buildService().resolveContext(citizen as any, {
      lat: "9.0765",
      lng: "7.3986",
      accuracy: "18",
      capturedAt: new Date().toISOString(),
    });

    expect(result.contextType).toBe("DYNAMIC_PUBLIC_AREA");
    expect(result.dynamicArea?.areaKey).toMatch(/^da:gh:/);
    expect(result.dynamicArea?.resolutionSource).toBe("geohash_cell");
    // Home-community lookup may read profile, but area resolution must not use profile jurisdiction.
    expect(result.dynamicArea?.areaKey).not.toContain("IKEJA");
    expect(jurisdictionResolution.diagnose).toHaveBeenCalled();
  });
});
