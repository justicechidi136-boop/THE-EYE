import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { NeighborhoodWatchService } from "../neighborhood-watch.service";

const userActor = { typ: "user", sub: "user-1", permissions: ["community:read", "community:join", "community:post", "community:volunteer"] } as any;
const moderatorActor = { typ: "user", sub: "mod-1", permissions: ["community:read", "community:join", "community:post", "community:volunteer"] } as any;
const adminActor = { typ: "admin", sub: "admin-1", role: "Super Admin", permissions: ["community:moderate", "community:verify", "incident:create", "broadcast:create"] } as any;
const stateAdminActor = { typ: "admin", sub: "state-admin", role: "State Admin", country: "NG", state: "LA", lga: "Ikeja", permissions: ["community:moderate", "community:verify"] } as any;

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    community: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ id: "community-1", visibility: "Private", status: "Active", country: "NG", state: "LA", lga: "Ikeja", createdById: "owner-1" }),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "community-1" }),
    },
    communityRole: { findFirst: jest.fn().mockResolvedValue({ id: "role-resident", name: "Resident" }), createMany: jest.fn().mockResolvedValue({ count: 7 }) },
    communityChannel: { createMany: jest.fn().mockResolvedValue({ count: 7 }) },
    communityMembership: {
      upsert: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
    },
    communityPost: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({ id: "post-1" }),
      count: jest.fn().mockResolvedValue(0),
    },
    communityPostComment: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn().mockResolvedValue(0) },
    communityContentReport: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    patrolAssignment: { findFirst: jest.fn().mockResolvedValue(null) },
    volunteerProfile: { count: jest.fn().mockResolvedValue(0) },
    patrolSchedule: { count: jest.fn().mockResolvedValue(0) },
    user: { findUnique: jest.fn().mockResolvedValue({ id: "user-1", status: "Active" }) },
    profile: { findUnique: jest.fn().mockResolvedValue({ userId: "user-1", country: "NG", state: "LA", lga: "Ikeja" }) },
    notification: { create: jest.fn().mockResolvedValue({ id: "notification-1" }) },
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
  const incidents = { report: jest.fn() } as any;
  const broadcasts = { create: jest.fn() } as any;
  const notifications = { enqueue: jest.fn().mockResolvedValue({ jobId: "job-1" }) } as any;
  const auditService = { record: jest.fn().mockResolvedValue({ id: "audit-1" }) } as any;
  return { service: new NeighborhoodWatchService(prisma, incidents, broadcasts, notifications, auditService), prisma, auditService };
}

describe("NeighborhoodWatch privilege escalation", () => {
  it("rejects citizen approving members", async () => {
    const update = jest.fn();
    const { service, prisma } = buildService({
      communityMembership: {
        findUnique: jest.fn().mockResolvedValue(null),
        update,
      },
    });
    await expect(service.approveMember("community-1", "membership-1", userActor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects citizen assigning moderator role", async () => {
    const { service } = buildService({
      communityMembership: {
        findUnique: jest.fn().mockResolvedValue({ id: "membership-1", status: "Approved", role: { name: "Resident" } }),
      },
      communityRole: { findFirst: jest.fn().mockResolvedValue({ id: "role-mod", name: "CommunityModerator" }) },
    });
    await expect(
      service.assignMemberRole("community-1", "membership-1", { roleName: "CommunityModerator" }, userActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects non-admin moderating community admin member", async () => {
    const { service } = buildService({
      communityMembership: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: "mod-1", communityId: "community-1", userId: "mod-1", status: "Approved", role: { name: "SecurityCoordinator" } })
          .mockResolvedValueOnce({ id: "target-1", communityId: "community-1", userId: "user-2", status: "Approved", role: { name: "EstateAdmin" } })
          .mockResolvedValueOnce({ id: "mod-1", communityId: "community-1", userId: "mod-1", status: "Approved", role: { name: "SecurityCoordinator" } }),
        update: jest.fn(),
      },
    });
    await expect(
      service.moderateMember("community-1", "target-1", { action: "suspend", note: "Policy" }, moderatorActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects cross-jurisdiction admin moderation", async () => {
    const { service } = buildService({
      community: {
        findUnique: jest.fn().mockResolvedValue({ id: "community-1", visibility: "Public", status: "Active", country: "NG", state: "AB", lga: "Other" }),
      },
    });
    await expect(
      service.moderateMember("community-1", "membership-1", { action: "suspend", note: "test" }, stateAdminActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects suspended member posting", async () => {
    const { service } = buildService({
      communityMembership: {
        findUnique: jest.fn().mockResolvedValue({ id: "membership-1", status: "Suspended", role: { name: "Resident" } }),
      },
    });
    await expect(
      service.createPost("community-1", { type: "SuspiciousActivity", title: "Gate activity", body: "Unknown visitor" }, userActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects hidden private community access for non-member", async () => {
    const { service } = buildService({
      community: { findUnique: jest.fn().mockResolvedValue({ id: "community-1", visibility: "Private", status: "Active" }) },
      communityMembership: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.getCommunity("community-1", userActor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects owner leaving without transfer", async () => {
    const { service } = buildService({
      community: { findUnique: jest.fn().mockResolvedValue({ id: "community-1", visibility: "Public", status: "Active", createdById: "user-1" }) },
      communityMembership: {
        findUnique: jest.fn().mockResolvedValue({ id: "membership-1", status: "Approved", role: { name: "Resident" } }),
      },
    });
    await expect(service.leaveCommunity("community-1", userActor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects leave during active patrol assignment", async () => {
    const { service } = buildService({
      community: { findUnique: jest.fn().mockResolvedValue({ id: "community-1", visibility: "Public", status: "Active", createdById: "owner-1" }) },
      communityMembership: {
        findUnique: jest.fn().mockResolvedValue({ id: "membership-1", status: "Approved", role: { name: "VerifiedVolunteer" } }),
      },
      patrolAssignment: { findFirst: jest.fn().mockResolvedValue({ id: "assignment-1" }) },
    });
    await expect(service.leaveCommunity("community-1", userActor)).rejects.toBeInstanceOf(BadRequestException);
  });
});
