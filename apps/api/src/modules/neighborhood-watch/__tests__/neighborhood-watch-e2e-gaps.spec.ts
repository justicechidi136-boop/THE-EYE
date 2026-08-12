import { ForbiddenException } from "@nestjs/common";
import { NeighborhoodWatchService } from "../neighborhood-watch.service";
import { buildNeighborhoodWatchNotificationMetadata } from "../../notifications/notification-routing.schema";

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    community: {
      findUnique: jest.fn().mockResolvedValue({
        id: "community-private",
        visibility: "Private",
        status: "Active",
        country: "NG",
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    communityMembership: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([{ userId: "member-1" }]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    communityPost: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({
        id: "post-1",
        communityId: "community-1",
        authorId: "author-1",
        title: "Suspicious",
        body: "Seen near gate",
        type: "SuspiciousActivity",
        incidentId: null,
        isEscalated: false,
        verificationStatus: "Verified",
        latitude: 6.52,
        longitude: 3.37,
        community: { id: "community-1", jurisdictionId: null },
      }),
      update: jest.fn().mockResolvedValue({ id: "post-1", incidentId: "incident-1", isEscalated: true }),
      count: jest.fn().mockResolvedValue(0),
    },
    communityAlert: {
      findFirst: jest.fn().mockResolvedValue({ id: "alert-1", communityId: "community-1", status: "Active" }),
      update: jest.fn().mockResolvedValue({ id: "alert-1", status: "Cancelled" }),
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    communityPinnedSafetyInfo: {
      findFirst: jest.fn().mockResolvedValue({ id: "pin-1", communityId: "community-1", active: true }),
      update: jest.fn().mockResolvedValue({ id: "pin-1", active: false }),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    patrolSchedule: {
      findUnique: jest.fn().mockResolvedValue({
        id: "patrol-1",
        communityId: "community-1",
        status: "Scheduled",
        title: "Evening walk",
      }),
      update: jest.fn().mockResolvedValue({ id: "patrol-1", status: "Active" }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    patrolAssignment: {
      findFirst: jest.fn().mockResolvedValue({ id: "assign-1", scheduleId: "patrol-1", userId: "user-1" }),
    },
    notification: { create: jest.fn().mockResolvedValue({ id: "n-1" }) },
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ lng: 3.37, lat: 6.52 }]),
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    policeStation: { findMany: jest.fn().mockResolvedValue([]) },
    volunteerProfile: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  } as any;
  const incidents = {
    report: jest.fn().mockResolvedValue({ data: { id: "incident-1" } }),
  } as any;
  const broadcasts = { create: jest.fn() } as any;
  const notifications = { enqueue: jest.fn().mockResolvedValue({ jobId: "job-1" }) } as any;
  const auditService = { record: jest.fn().mockResolvedValue({ id: "audit-1" }) } as any;
  const dangerZoneGeo = {
    findActiveZonesNearPoint: jest.fn().mockResolvedValue([
      {
        id: "dz-1",
        status: "ActiveModerate",
        severity: "Moderate",
        distance_meters: 120,
        public_message: "Avoid intersection",
        avoidance_instruction: "Use alternate route",
        inner_radius_meters: 100,
        warning_radius_meters: 300,
        outer_awareness_radius_meters: 800,
      },
    ]),
  } as any;
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
    incidents,
    dangerZoneGeo,
  };
}

const citizen = { typ: "user", sub: "user-1", role: "Citizen" } as any;
const moderatorMembership = {
  id: "m-1",
  status: "Approved",
  role: { name: "CommunityModerator" },
};

describe("Neighborhood Watch E2E gap coverage", () => {
  it("denies private community feed without approved membership", async () => {
    const { service, prisma } = buildService();
    await expect(service.feed("community-private", citizen, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.communityPost.findMany).not.toHaveBeenCalled();
  });

  it("returns danger zones on community map", async () => {
    const { service, dangerZoneGeo } = buildService({
      community: {
        findUnique: jest.fn().mockResolvedValue({
          id: "community-1",
          visibility: "Public",
          status: "Active",
          country: "NG",
        }),
      },
      communityMembership: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      patrolSchedule: { findMany: jest.fn().mockResolvedValue([]) },
      communityAlert: { findMany: jest.fn().mockResolvedValue([]) },
      communityPinnedSafetyInfo: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const result = await service.map("community-1", citizen);
    expect(dangerZoneGeo.findActiveZonesNearPoint).toHaveBeenCalled();
    expect(result.data.dangerZones).toHaveLength(1);
    expect(result.data.dangerZones[0]).toEqual(
      expect.objectContaining({
        id: "dz-1",
        publicMessage: "Avoid intersection",
      }),
    );
  });

  it("cancels community alerts and deactivates pinned safety", async () => {
    const { service, prisma } = buildService({
      communityMembership: {
        findUnique: jest.fn().mockResolvedValue(moderatorMembership),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    const cancelled = await service.cancelCommunityAlert("community-1", "alert-1", citizen);
    expect(cancelled.data.status).toBe("Cancelled");
    expect(prisma.communityAlert.update).toHaveBeenCalled();

    const deactivated = await service.deactivatePinnedSafetyInfo("community-1", "pin-1", citizen);
    expect(deactivated.data.active).toBe(false);
  });

  it("starts a joined patrol and notifies with NW route metadata", async () => {
    const { service, prisma } = buildService({
      communityMembership: {
        findUnique: jest.fn().mockResolvedValue(moderatorMembership),
        findMany: jest.fn().mockResolvedValue([{ userId: "member-1" }]),
      },
    });
    const result = await service.transitionPatrol("patrol-1", "Active", citizen);
    expect(result.data.status).toBe("Active");
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it("escalates a post to incident idempotently", async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: "post-1",
        communityId: "community-1",
        authorId: "author-1",
        title: "Suspicious",
        body: "Seen near gate",
        type: "SuspiciousActivity",
        incidentId: null,
        isEscalated: false,
        verificationStatus: "Verified",
        latitude: 6.52,
        longitude: 3.37,
        community: { id: "community-1", jurisdictionId: null },
      })
      .mockResolvedValueOnce({
        id: "post-1",
        communityId: "community-1",
        authorId: "author-1",
        title: "Suspicious",
        body: "Seen near gate",
        type: "SuspiciousActivity",
        incidentId: "incident-1",
        isEscalated: true,
        escalatedAt: new Date("2026-08-12T00:00:00.000Z"),
        escalatedById: "user-1",
        verificationStatus: "Verified",
        latitude: 6.52,
        longitude: 3.37,
        community: { id: "community-1", jurisdictionId: null },
      });
    const { service, incidents } = buildService({
      communityMembership: {
        findUnique: jest.fn().mockResolvedValue(moderatorMembership),
      },
      communityPost: {
        findUnique,
        update: jest.fn().mockResolvedValue({ id: "post-1", incidentId: "incident-1" }),
      },
    });
    const first = await service.convertPostToIncident("post-1", citizen);
    expect(first.data.resultingIncidentId).toBe("incident-1");
    expect(incidents.report).toHaveBeenCalledTimes(1);

    const second = await service.convertPostToIncident("post-1", citizen);
    expect(second.data.duplicate).toBe(true);
    expect(second.data.resultingIncidentId).toBe("incident-1");
    expect(incidents.report).toHaveBeenCalledTimes(1);
  });

  it("builds NW notification destinations under /neighborhood-watch", () => {
    const meta = buildNeighborhoodWatchNotificationMetadata({
      routeType: "NW_COMMUNITY_ALERT",
      communityId: "community-1",
      notificationType: "NwCommunityAlert",
    });
    expect(meta.destination).toBe("/neighborhood-watch/alerts");
    expect(meta.routeType).toBe("NW_COMMUNITY_ALERT");
  });
});
