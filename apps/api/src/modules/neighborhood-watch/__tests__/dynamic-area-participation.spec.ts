import { ForbiddenException } from "@nestjs/common";
import { NeighborhoodWatchService } from "../neighborhood-watch.service";
import { MAX_LOCATION_AGE_MS } from "../neighborhood-watch-context.service";

describe("NeighborhoodWatchService dynamic area participation", () => {
  const prisma = {
    nwDynamicAreaPresence: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    communityPost: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    communityPostComment: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    communityContentReport: { create: jest.fn() },
    communityMembership: { findUnique: jest.fn(), findMany: jest.fn() },
    community: { findUnique: jest.fn() },
    trustedReporter: { findUnique: jest.fn().mockResolvedValue(null) },
    notification: { create: jest.fn().mockResolvedValue({ id: "n1" }) },
    $executeRawUnsafe: jest.fn(),
  };

  const auditService = { record: jest.fn() };
  const incidents = {};
  const broadcasts = {};
  const notifications = { enqueue: jest.fn(), enqueuePushForUser: jest.fn() };
  const dangerZoneGeo = {};

  const service = new NeighborhoodWatchService(
    prisma as never,
    incidents as never,
    broadcasts as never,
    notifications as never,
    auditService as never,
    dangerZoneGeo as never,
  );

  const citizen = { typ: "user", sub: "11111111-1111-4111-8111-111111111111" };

  it("rejects new Dynamic Area posts when presence is missing", async () => {
    prisma.nwDynamicAreaPresence.findFirst = jest.fn().mockResolvedValue(null);
    await expect(
      service.createDynamicAreaPost(
        { type: "Discussion", title: "Hello area", body: "Safety talk" } as never,
        citizen as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects new Dynamic Area posts when GPS capture is stale", async () => {
    prisma.nwDynamicAreaPresence.findFirst.mockResolvedValue({
      areaKey: "da:NIGERIA:RIVERS:OBIO_AKPOR",
      areaCountry: "Nigeria",
      areaState: "Rivers",
      areaLga: "Obio-Akpor",
      areaCity: null,
      areaLabel: "Obio-Akpor, Rivers, Nigeria",
      capturedAt: new Date(Date.now() - MAX_LOCATION_AGE_MS - 60_000),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    await expect(
      service.createDynamicAreaPost(
        { type: "SafetyTip", title: "Lock doors early", body: "Lock doors" } as never,
        citizen as never,
      ),
    ).rejects.toThrow(/stale/i);
  });

  it("creates a Dynamic Area post from server presence (ignores client areaKey)", async () => {
    prisma.nwDynamicAreaPresence.findFirst.mockResolvedValue({
      areaKey: "da:NIGERIA:ENUGU:ENUGU_NORTH",
      areaCountry: "Nigeria",
      areaState: "Enugu",
      areaLga: "Enugu North",
      areaCity: "Enugu",
      areaLabel: "Enugu North, Enugu, Nigeria",
      capturedAt: new Date(),
      expiresAt: new Date(Date.now() + 20 * 60 * 1000),
    });
    prisma.communityPost.create.mockResolvedValue({
      id: "post-da-1",
      title: "Traveler tip",
      type: "SafetyTip",
    });
    prisma.communityPost.findUnique.mockResolvedValue({
      id: "post-da-1",
      title: "Traveler tip",
      type: "SafetyTip",
      latitude: null,
      longitude: null,
      media: [],
      reactions: [],
      incidentId: null,
      targetType: "DYNAMIC_AREA",
      dynamicAreaKey: "da:NIGERIA:ENUGU:ENUGU_NORTH",
      areaLabel: "Enugu North, Enugu, Nigeria",
      areaCity: "Enugu",
      areaLga: "Enugu North",
      confidenceScore: 10,
    });
    prisma.communityPost.update.mockImplementation(async ({ data }: any) => ({
      id: "post-da-1",
      title: "Traveler tip",
      type: "SafetyTip",
      targetType: "DYNAMIC_AREA",
      dynamicAreaKey: "da:NIGERIA:ENUGU:ENUGU_NORTH",
      areaLabel: "Enugu North, Enugu, Nigeria",
      areaCity: "Enugu",
      areaLga: "Enugu North",
      latitude: null,
      longitude: null,
      ...data,
    }));

    const result = await service.createDynamicAreaPost(
      {
        type: "SafetyTip",
        title: "Traveler tip",
        body: "Stay aware",
        // Client cannot force a different area via DTO — presence wins.
      } as never,
      citizen as never,
    );

    expect(prisma.communityPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          communityId: null,
          targetType: "DYNAMIC_AREA",
          dynamicAreaKey: "da:NIGERIA:ENUGU:ENUGU_NORTH",
        }),
      }),
    );
    expect(result.data.latitude).toBeUndefined();
    expect(result.data.longitude).toBeUndefined();
    expect(result.data.dynamicAreaKey).toBe("da:NIGERIA:ENUGU:ENUGU_NORTH");
  });

  it("allows comments on existing Dynamic Area threads within presence TTL", async () => {
    prisma.communityPost.findUnique.mockResolvedValue({
      id: "post-da-2",
      authorId: "other-user",
      communityId: null,
      targetType: "DYNAMIC_AREA",
      dynamicAreaKey: "da:NIGERIA:ENUGU:ENUGU_NORTH",
    });
    prisma.nwDynamicAreaPresence.findUnique.mockResolvedValue({
      areaKey: "da:NIGERIA:ENUGU:ENUGU_NORTH",
      capturedAt: new Date(Date.now() - 10 * 60 * 1000), // older than 5m
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // still in 30m window
    });
    prisma.communityPostComment.create.mockResolvedValue({
      id: "c1",
      body: "Thanks",
      createdAt: new Date(),
      durationSeconds: null,
    });

    const result = await service.createPostComment(
      "post-da-2",
      { body: "Thanks" } as never,
      citizen as never,
    );
    expect(result.data.body).toBe("Thanks");
  });
});
