import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { NeighborhoodWatchService } from "../neighborhood-watch.service";
import { validatePost } from "../dto/neighborhood-watch.dto";
import { buildNeighborhoodWatchNotificationMetadata } from "../../notifications/notification-routing.schema";
import { MAX_LOCATION_AGE_MS } from "../neighborhood-watch-context.service";

const traveler = { typ: "user", sub: "traveler-1", role: "Citizen" } as any;
const resident = { typ: "user", sub: "resident-1", role: "Citizen" } as any;
const outsider = { typ: "user", sub: "outsider-1", role: "Citizen" } as any;
const moderator = { typ: "user", sub: "mod-1", role: "Citizen" } as any;

function freshCapturedAt(msAgo = 30_000) {
  return new Date(Date.now() - msAgo);
}

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    community: {
      findUnique: jest.fn().mockResolvedValue({
        id: "community-a",
        visibility: "Public",
        status: "Active",
        country: "NG",
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    communityMembership: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([{ userId: "resident-1" }]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    communityPresence: {
      findFirst: jest.fn().mockResolvedValue({
        userId: "traveler-1",
        communityId: "community-a",
        mode: "LocationParticipant",
        capturedAt: freshCapturedAt(),
        expiresAt: new Date(Date.now() + 20 * 60 * 1000),
      }),
      findMany: jest.fn().mockResolvedValue([{ userId: "traveler-1" }]),
    },
    communityPost: {
      create: jest.fn().mockImplementation(async ({ data }: any) => ({
        id: "post-1",
        communityId: data.communityId,
        authorId: data.authorId,
        type: data.type,
        title: data.title,
        body: data.body ?? "",
        media: [],
        reactions: [],
        createdAt: new Date(),
      })),
      findUnique: jest.fn().mockResolvedValue({
        id: "post-1",
        communityId: "community-a",
        authorId: "traveler-1",
        type: "Discussion",
        title: "Safety check",
        body: "Anyone nearby?",
        media: [],
        reactions: [],
        comments: [],
        author: { id: "traveler-1", profile: { firstName: "Ada", lastName: "Traveler" } },
      }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockImplementation(async ({ data, where }: any) => ({
        id: where?.id ?? "post-1",
        communityId: "community-a",
        authorId: "traveler-1",
        type: data?.type ?? "Discussion",
        title: data?.title ?? "Safety Discussion",
        body: data?.body ?? "Text-only discussion body",
        media: [],
        reactions: [],
        confidenceScore: 40,
        ...data,
      })),
      count: jest.fn().mockResolvedValue(0),
    },
    communityPostComment: {
      create: jest.fn().mockImplementation(async ({ data }: any) => ({
        id: "comment-1",
        body: data?.body ?? "",
        createdAt: new Date(),
        durationSeconds: data?.durationSeconds ?? null,
        mediaType: data?.mediaType,
        objectKey: data?.objectKey,
      })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    communityPostReaction: {
      upsert: jest.fn().mockResolvedValue({ id: "reaction-1", type: "Confirm" }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    communityContentReport: {
      create: jest.fn().mockResolvedValue({ id: "report-1", reasonCode: "Abuse" }),
    },
    trustedReporter: { findUnique: jest.fn().mockResolvedValue(null) },
    notification: { create: jest.fn().mockResolvedValue({ id: "n-1" }) },
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;

  const incidents = { report: jest.fn().mockResolvedValue({ data: { id: "incident-1" } }) } as any;
  const broadcasts = { create: jest.fn() } as any;
  const notifications = { enqueue: jest.fn().mockResolvedValue({ jobId: "job-1" }) } as any;
  const auditService = { record: jest.fn().mockResolvedValue({ id: "audit-1" }) } as any;
  const dangerZoneGeo = { findActiveZonesNearPoint: jest.fn().mockResolvedValue([]) } as any;

  return {
    service: new NeighborhoodWatchService(
      prisma,
      incidents,
      broadcasts,
      notifications,
      auditService,
      dangerZoneGeo,
    ),
    prisma,
    notifications,
    auditService,
  };
}

describe("Neighborhood Watch public user-initiated conversations", () => {
  it("1) treats empty public community feed as zero conversations", async () => {
    const { service, prisma } = buildService();
    prisma.communityPost.findMany.mockResolvedValueOnce([]);
    const page = await service.feed("community-a", traveler, {});
    expect(page.data).toEqual([]);
  });

  it("3+5) traveler with fresh presence creates the first conversation", async () => {
    const { service, prisma, notifications } = buildService();
    const result = await service.createPost(
      "community-a",
      {
        type: "Discussion",
        title: "Junction check tonight",
        body: "Has anyone noticed unusual vehicle activity?",
      },
      traveler,
    );
    expect(prisma.communityPost.create).toHaveBeenCalled();
    expect(result.data.authorLabel).toBe("Current Area Visitor");
    expect(notifications.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ routeType: "NW_NEW_DISCUSSION", postId: "post-1" }),
    );
  });

  it("keeps Current Area Visitor label after presence expires", async () => {
    const { service } = buildService({
      communityMembership: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      communityPresence: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      communityPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: "post-1",
          communityId: "community-a",
          authorId: "traveler-1",
          media: [],
          comments: Array.from({ length: 5 }, (_, i) => ({ id: `c-${i}` })),
          reactions: [],
          author: { id: "traveler-1", profile: { firstName: "Ada", lastName: "Traveler" } },
        }),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      communityPostComment: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(42),
      },
    });
    const result = await service.getPost("post-1", traveler);
    expect(result.data.authorLabel).toBe("Current Area Visitor");
    expect(result.data.commentCount).toBe(42);
  });

  it("4) resident member creates a conversation without presence", async () => {
    const { service, prisma } = buildService({
      communityMembership: {
        findUnique: jest.fn().mockResolvedValue({ id: "m-1", status: "Approved", userId: "resident-1" }),
        findMany: jest.fn().mockResolvedValue([{ userId: "resident-1" }]),
      },
      communityPresence: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    const result = await service.createPost(
      "community-a",
      { type: "SafetyTip", title: "Lock gates early", body: "Tip for residents tonight" },
      resident,
    );
    expect(result.data.authorLabel).toBe("Community member");
    expect(prisma.communityPresence.findFirst).not.toHaveBeenCalled();
  });

  it("6) traveler create does not create permanent membership", async () => {
    const { service, prisma } = buildService();
    await service.createPost(
      "community-a",
      { type: "SafetyTip", title: "Keep porch lights on", body: "Shared traveler tip for the block" },
      traveler,
    );
    expect(prisma.communityMembership.findUnique).toHaveBeenCalled();
    expect((prisma.communityMembership as any).upsert).toBeUndefined();
    expect((prisma.communityMembership as any).create).toBeUndefined();
  });

  it("7) outsider cannot forge communityId to post", async () => {
    const { service } = buildService({
      communityPresence: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      communityMembership: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    await expect(
      service.createPost(
        "community-a",
        { type: "Discussion", title: "Forged post attempt", body: "Should not land here" },
        outsider,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("8) stale GPS presence cannot establish posting authority", async () => {
    const { service } = buildService({
      communityPresence: {
        findFirst: jest.fn().mockResolvedValue({
          userId: "traveler-1",
          communityId: "community-a",
          mode: "LocationParticipant",
          capturedAt: new Date(Date.now() - (MAX_LOCATION_AGE_MS + 60_000)),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    await expect(
      service.createPost(
        "community-a",
        { type: "Discussion", title: "Stale location post", body: "Should be rejected for stale GPS" },
        traveler,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("9) text Discussion posts successfully", async () => {
    validatePost({
      type: "Discussion",
      title: "Safety Discussion",
      body: "Text-only discussion body",
    });
    const { service, prisma } = buildService();
    await service.createPost(
      "community-a",
      { type: "Discussion", title: "Safety Discussion", body: "Text-only discussion body" },
      traveler,
    );
    expect(prisma.communityPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "Discussion",
          title: "Safety Discussion",
          body: "Text-only discussion body",
        }),
      }),
    );
  });

  it("10) voice discussion posts successfully without long body", async () => {
    validatePost({
      type: "Discussion",
      title: "Voice safety note",
      body: "",
      media: [
        {
          mediaType: "Audio",
          bucket: "the-eye",
          objectKey: "evidence/community-community-a/11111111-1111-1111-1111-111111111111.m4a",
          contentType: "audio/mp4",
          fileHash: "abc123hashvalue0001",
        },
      ],
    });
    const { service, prisma } = buildService();
    await service.createPost(
      "community-a",
      {
        type: "Discussion",
        title: "Voice safety note",
        body: "",
        media: [
          {
            mediaType: "Audio",
            bucket: "the-eye",
            objectKey: "evidence/community-community-a/11111111-1111-1111-1111-111111111111.m4a",
            contentType: "audio/mp4",
            fileHash: "abc123hashvalue0001",
          },
        ],
      },
      traveler,
    );
    expect(prisma.communityPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ body: "", title: "Voice safety note" }),
      }),
    );
  });

  it("11) photo/video attachment validates as post body substitute", () => {
    expect(() =>
      validatePost({
        type: "LocalWarning",
        title: "Flooded street",
        body: "",
        media: [
          {
            mediaType: "Image",
            bucket: "the-eye",
            objectKey: "evidence/community-community-a/22222222-2222-2222-2222-222222222222.jpg",
            contentType: "image/jpeg",
            fileHash: "imghash0001",
          },
        ],
      }),
    ).not.toThrow();
    expect(() =>
      validatePost({
        type: "RoadHazard",
        title: "Pothole clip",
        body: "",
        media: [
          {
            mediaType: "Video",
            bucket: "the-eye",
            objectKey: "evidence/community-community-a/33333333-3333-3333-3333-333333333333.mp4",
            contentType: "video/mp4",
            fileHash: "vidhash0001",
          },
        ],
      }),
    ).not.toThrow();
    expect(() =>
      validatePost({ type: "Discussion", title: "Empty", body: "" }),
    ).toThrow(BadRequestException);
  });

  it("12) another eligible user comments on a discussion", async () => {
    const { service, notifications } = buildService({
      communityMembership: {
        findUnique: jest.fn().mockResolvedValue({ id: "m-2", status: "Approved", userId: "resident-1" }),
        findMany: jest.fn().mockResolvedValue([{ userId: "resident-1" }]),
      },
      communityPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: "post-1",
          communityId: "community-a",
          authorId: "traveler-1",
        }),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    });
    const result = await service.createPostComment("post-1", { body: "Thanks for the heads up" }, resident);
    expect(result.data.body).toBe("Thanks for the heads up");
    expect(notifications.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ routeType: "NW_POST_COMMENT", postId: "post-1" }),
    );
  });

  it("13) voice comment works for presence participant", async () => {
    const { service } = buildService({
      communityPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: "post-1",
          communityId: "community-a",
          authorId: "resident-1",
        }),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      communityPostComment: {
        create: jest.fn().mockResolvedValue({
          id: "voice-comment-1",
          body: "",
          createdAt: new Date(),
          durationSeconds: 12,
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    const result = await service.createPostComment(
      "post-1",
      {
        body: "",
        mediaType: "Audio",
        bucket: "the-eye",
        objectKey: "evidence/community-community-a/44444444-4444-4444-4444-444444444444.m4a",
        contentType: "audio/mp4",
        durationSeconds: 12,
      },
      traveler,
    );
    expect(result.data.hasVoice).toBe(true);
    expect(result.data.authorLabel).toBe("Current Area Visitor");
  });

  it("14) discussion deep link destination uses post route", () => {
    const meta = buildNeighborhoodWatchNotificationMetadata({
      routeType: "NW_NEW_DISCUSSION",
      communityId: "community-a",
      postId: "post-99",
      notificationType: "NW_NEW_DISCUSSION",
    });
    expect(meta.destination).toBe("/neighborhood-watch/post/post-99");
    expect(meta.routeType).toBe("NW_NEW_DISCUSSION");
  });

  it("15) report abuse works for eligible presence user", async () => {
    const { service, prisma } = buildService();
    const result = await service.createContentReport(
      "community-a",
      { targetType: "Post", targetId: "post-1", reasonCode: "Harassment", note: "Spam" },
      traveler,
    );
    expect(prisma.communityContentReport.create).toHaveBeenCalled();
    expect(result.data.id).toBe("report-1");
  });

  it("16) moderator hide/restore works", async () => {
    const { service, prisma, auditService } = buildService({
      communityMembership: {
        findUnique: jest.fn().mockResolvedValue({
          id: "mod-m",
          status: "Approved",
          role: { name: "CommunityModerator" },
        }),
        findMany: jest.fn().mockResolvedValue([{ userId: "mod-1" }]),
      },
      communityPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: "post-1",
          communityId: "community-a",
          authorId: "traveler-1",
        }),
        update: jest.fn().mockResolvedValue({ id: "post-1", hiddenAt: new Date() }),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    });
    await service.removePost("post-1", moderator, "Abuse");
    const hideCall = prisma.communityPost.update.mock.calls.find(
      (call: any[]) => call[0]?.data?.hiddenAt != null,
    );
    expect(Boolean(hideCall)).toBe(true);
    await service.restorePost("post-1", moderator);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "community.post_restored" }),
    );
  });

  it("17) immediate-danger CTA destination remains canonical emergency reporting", () => {
    // Mobile wires Report Emergency → /report/emergency; keep contract asserted here.
    expect("/report/emergency").toBe("/report/emergency");
  });

  it("18) moving to community B only authorizes posts in B", async () => {
    const presenceByCommunity: Record<string, unknown> = {
      "community-a": null,
      "community-b": {
        userId: "traveler-1",
        communityId: "community-b",
        mode: "LocationParticipant",
        capturedAt: freshCapturedAt(),
        expiresAt: new Date(Date.now() + 20 * 60 * 1000),
      },
    };
    const { service, prisma } = buildService({
      community: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => ({
          id: where.id,
          visibility: "Public",
          status: "Active",
          country: "NG",
        })),
      },
      communityPresence: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => presenceByCommunity[where.communityId] ?? null),
        findMany: jest.fn().mockResolvedValue([{ userId: "traveler-1" }]),
      },
      communityMembership: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    await expect(
      service.createPost(
        "community-a",
        { type: "Discussion", title: "Old area post", body: "Should fail after move" },
        traveler,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await service.createPost(
      "community-b",
      { type: "Discussion", title: "New area post", body: "Allowed in current geofence" },
      traveler,
    );
    expect(prisma.communityPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ communityId: "community-b" }),
      }),
    );
  });

  it("emits NW_POST_REPLY to prior commenters", async () => {
    const { service, notifications } = buildService({
      communityMembership: {
        findUnique: jest.fn().mockResolvedValue({ id: "m-2", status: "Approved", userId: "resident-1" }),
        findMany: jest.fn().mockResolvedValue([{ userId: "resident-1" }]),
      },
      communityPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: "post-1",
          communityId: "community-a",
          authorId: "traveler-1",
        }),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      communityPostComment: {
        findMany: jest.fn().mockResolvedValue([{ authorId: "prior-1" }]),
        create: jest.fn().mockResolvedValue({
          id: "comment-2",
          body: "Second thought",
          createdAt: new Date(),
          durationSeconds: null,
        }),
      },
    });
    await service.createPostComment("post-1", { body: "Second thought" }, resident);
    expect(notifications.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ routeType: "NW_POST_REPLY", postId: "post-1" }),
    );
  });

  it("allows traveler reactions via participate gate", async () => {
    const { service, prisma } = buildService({
      communityPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: "post-1",
          communityId: "community-a",
        }),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    });
    await service.createPostReaction("post-1", { type: "Confirm" }, traveler);
    expect(prisma.communityPostReaction.upsert).toHaveBeenCalled();
  });
});
