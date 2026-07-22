import { ForbiddenException } from "@nestjs/common";
import { IncidentType } from "@the-eye/shared";
import { NeighborhoodWatchService } from "../neighborhood-watch.service";

const userActor = { typ: "user", sub: "user-1", permissions: ["community:read", "community:join", "community:post", "community:volunteer"] } as any;
const adminActor = { typ: "admin", sub: "admin-1", role: "Super Admin", permissions: ["community:moderate", "community:verify", "incident:create", "broadcast:create"] } as any;

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    community: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ id: "community-1", visibility: "Public", status: "Active", jurisdictionId: "jurisdiction-1" }),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "community-1" }),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ id: "user-1", status: "Active" }) },
    communityRole: {
      findFirst: jest.fn().mockResolvedValue({ id: "role-resident", name: "Resident" }),
      createMany: jest.fn().mockResolvedValue({ count: 7 }),
    },
    communityChannel: { createMany: jest.fn().mockResolvedValue({ count: 7 }) },
    communityMembership: {
      upsert: jest.fn().mockResolvedValue({ id: "membership-1", communityId: "community-1", userId: "user-1", status: "Approved" }),
      update: jest.fn().mockResolvedValue({ id: "membership-1", status: "Approved" }),
      findUnique: jest.fn().mockResolvedValue({ id: "membership-1", status: "Approved", role: { name: "CommunityModerator" } }),
      findMany: jest.fn().mockResolvedValue([{ userId: "user-2" }]),
    },
    communityPost: {
      create: jest.fn().mockResolvedValue({ id: "post-1", communityId: "community-1", authorId: "user-1", type: "SuspiciousActivity", title: "Suspicious movement", body: "Movement near gate", media: [], reactions: [] }),
      findUnique: jest.fn().mockResolvedValue({ id: "post-1", communityId: "community-1", authorId: "user-1", type: "SuspiciousActivity", title: "Suspicious movement", body: "Movement near gate", latitude: 6.6012, longitude: 3.3514, verificationStatus: "Verified", community: { id: "community-1", jurisdictionId: "jurisdiction-1" }, media: [], reactions: [], incidentId: null }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ id: "post-1", confidenceScore: 80, verificationStatus: "Verified", title: "Suspicious movement", type: "SuspiciousActivity" }),
    },
    communityVerification: { create: jest.fn().mockResolvedValue({ id: "verification-1" }) },
    trustedReporter: { findUnique: jest.fn().mockResolvedValue({ trustScore: 80 }) },
    notification: { create: jest.fn().mockResolvedValue({ id: "notification-1" }) },
    volunteerProfile: { upsert: jest.fn().mockResolvedValue({ id: "volunteer-1" }), findMany: jest.fn().mockResolvedValue([]) },
    patrolSchedule: { create: jest.fn().mockResolvedValue({ id: "patrol-1" }), findMany: jest.fn().mockResolvedValue([]) },
    patrolCheckpoint: { create: jest.fn().mockResolvedValue({ id: "checkpoint-1" }) },
    policeStation: { findMany: jest.fn().mockResolvedValue([]) },
    communityRequest: { create: jest.fn().mockResolvedValue({ id: "request-1", status: "Pending" }) },
    communityPostComment: { create: jest.fn().mockResolvedValue({ id: "comment-1", body: "Thanks" }) },
    profile: { findUnique: jest.fn().mockResolvedValue({ userId: "user-1", country: "NG", state: "LA", lga: "Ikeja" }) },
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
  const incidents = { report: jest.fn().mockResolvedValue({ data: { id: "incident-1", type: IncidentType.Crime } }) } as any;
  const broadcasts = { create: jest.fn().mockResolvedValue({ data: { id: "broadcast-1" } }) } as any;
  const notifications = { enqueue: jest.fn().mockResolvedValue({ jobId: "job-1" }) } as any;
  const auditService = { record: jest.fn().mockResolvedValue({ id: "audit-1" }) } as any;
  return { service: new NeighborhoodWatchService(prisma, incidents, broadcasts, notifications, auditService), prisma, incidents, broadcasts, notifications, auditService };
}

describe("NeighborhoodWatchService", () => {
  it("joins a public community immediately", async () => {
    const { service, prisma } = buildService({
      communityMembership: {
        upsert: jest.fn().mockResolvedValue({ id: "membership-1", communityId: "community-1", userId: "user-1", status: "Approved" }),
        update: jest.fn().mockResolvedValue({ id: "membership-1", status: "Approved" }),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    });
    await service.joinCommunity("community-1", userActor);
    expect(prisma.communityMembership.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ status: "Approved" }),
    }));
  });

  it("approves a pending member and audits the moderator action", async () => {
    const { service, auditService } = buildService();
    await service.approveMember("community-1", "membership-1", adminActor);
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: "community.member_approved" }));
  });

  it("creates a post and targets community notifications", async () => {
    const { service, notifications } = buildService();
    await service.createPost("community-1", { type: "SuspiciousActivity", title: "Suspicious movement", body: "Movement near gate" }, userActor);
    expect(notifications.enqueue).toHaveBeenCalledWith(expect.objectContaining({ communityId: "community-1", postId: "post-1" }));
  });

  it("verifies a post with moderator confirmation", async () => {
    const { service, prisma } = buildService();
    await service.verifyPost("post-1", { status: "Verified", moderatorConfirmed: true }, adminActor);
    expect(prisma.communityVerification.create).toHaveBeenCalled();
    expect(prisma.communityPost.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ verificationStatus: "Verified" }) }));
  });

  it("converts a community post to an incident", async () => {
    const { service, incidents, prisma } = buildService();
    await service.convertPostToIncident("post-1", adminActor);
    expect(incidents.report).toHaveBeenCalledWith(expect.objectContaining({ type: IncidentType.Crime }), adminActor);
    expect(prisma.communityPost.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ incidentId: "incident-1" }) }));
  });

  it("broadcasts a verified community alert", async () => {
    const { service, broadcasts } = buildService();
    await service.broadcastVerifiedPost("post-1", "Neighborhood", adminActor);
    expect(broadcasts.create).toHaveBeenCalledWith(expect.objectContaining({ title: "Suspicious movement" }), adminActor);
  });

  it("blocks non-moderators from approving members", async () => {
    const { service, prisma } = buildService({
      communityMembership: {
        findUnique: jest.fn().mockResolvedValue({ id: "membership-1", status: "Approved", role: { name: "Resident" } }),
      },
    });
    await expect(service.approveMember("community-1", "membership-1", userActor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.communityMembership.findUnique).toHaveBeenCalled();
  });

  it("rejects a pending member", async () => {
    const { service, prisma, auditService } = buildService({
      communityMembership: {
        findUnique: jest.fn().mockResolvedValue({ id: "membership-1", communityId: "community-1", userId: "user-2", status: "Pending", role: { name: "CommunityModerator" } }),
        update: jest.fn().mockResolvedValue({ id: "membership-1", status: "Rejected" }),
      },
    });
    await service.rejectMember("community-1", "membership-1", adminActor, "Not eligible");
    expect(prisma.communityMembership.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "Rejected" }) }));
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: "community.member_rejected" }));
  });

  it("creates a community request for citizens", async () => {
    const { service, prisma } = buildService({
      profile: { findUnique: jest.fn().mockResolvedValue({ userId: "user-1", country: "NG", state: "LA", lga: "Ikeja" }) },
      community: { findFirst: jest.fn().mockResolvedValue(null) },
      communityRequest: { create: jest.fn().mockResolvedValue({ id: "request-1", status: "Pending" }) },
    });
    await service.createCommunityRequest({
      name: "New Estate",
      country: "NG",
      state: "LA",
      lga: "Ikeja",
    }, userActor);
    expect(prisma.communityRequest.create).toHaveBeenCalled();
  });

  it("creates a post comment for approved members", async () => {
    const { service, prisma } = buildService({
      communityPostComment: { create: jest.fn().mockResolvedValue({ id: "comment-1", body: "Thanks" }) },
    });
    await service.createPostComment("post-1", { body: "Thanks for the update" }, userActor);
    expect(prisma.communityPostComment.create).toHaveBeenCalled();
  });
});
