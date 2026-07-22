import { BadRequestException } from "@nestjs/common";
import { BroadcastStatus } from "@the-eye/shared";
import { createMetricsMock } from "../../../common/metrics/metrics.test-utils";
import { BROADCAST_SYSTEM_ACTOR, BroadcastsService } from "../broadcasts.service";

function buildService(prisma: Record<string, unknown>) {
  const notificationsService = {
    enqueue: jest.fn().mockResolvedValue({ queued: true, duplicate: false, jobId: "job-1" }),
  };
  const auditService = { record: jest.fn().mockResolvedValue(undefined) };
  const schedulerDiagnostics = { getHealth: jest.fn().mockResolvedValue({ active: true }) };
  return {
    service: new BroadcastsService(
      prisma as any,
      notificationsService as any,
      auditService as any,
      createMetricsMock(),
      schedulerDiagnostics as any,
    ),
    auditService,
    prisma,
  };
}

describe("BroadcastsService scheduler", () => {
  it("does not dispatch future scheduled broadcasts on create", async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    let dispatchCalled = false;
    const prisma = {
      broadcast: {
        create: jest.fn().mockResolvedValue({ id: "b1" }),
        findUnique: jest.fn().mockResolvedValue({
          id: "b1",
          status: BroadcastStatus.Scheduled,
          scheduledAt: new Date(future),
          deliveries: [],
          notifications: [],
        }),
      },
      $executeRawUnsafe: jest.fn(),
    };
    const { service } = buildService(prisma);
    (service as any).writeGeofence = jest.fn().mockResolvedValue(undefined);
    (service as any).dispatch = jest.fn().mockImplementation(async () => {
      dispatchCalled = true;
      return { data: {}, recipientCount: 0 };
    });

    await service.create(
      {
        type: "Emergency",
        title: "Scheduled alert title",
        body: "Scheduled alert body copy",
        priority: "P2ActiveCrimeAccident",
        jurisdictionId: "jurisdiction-1",
        scheduledAt: future,
      } as any,
      { typ: "admin", sub: "admin-1", permissions: ["broadcast:create"] } as any,
    );

    expect(prisma.broadcast.create.mock.calls[0]?.[0]?.data?.status).toBe(BroadcastStatus.Scheduled);
    expect(dispatchCalled).toBe(false);
  });

  it("claims due broadcasts with skip locked update", async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: "due-1" }, { id: "due-2" }]),
    };
    const { service } = buildService(prisma);
    const claimed = await service.claimDueBroadcasts(25);
    expect(claimed).toEqual(["due-1", "due-2"]);
    expect(String(prisma.$queryRawUnsafe.mock.calls[0]?.[0])).toContain("FOR UPDATE SKIP LOCKED");
  });

  it("reverts claim when queue enqueue fails", async () => {
    const prisma = {
      broadcast: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const { service, auditService } = buildService(prisma);

    await service.revertDispatchClaim("b1", new Error("queue unavailable"));

    expect(prisma.broadcast.updateMany.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        where: { id: "b1", status: BroadcastStatus.DispatchQueued },
        data: expect.objectContaining({ status: BroadcastStatus.Scheduled }),
      }),
    );
    expect(auditService.record.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ action: "broadcast.auto_dispatch_failed", entityId: "b1" }),
    );
  });

  it("skips auto dispatch for cancelled broadcasts", async () => {
    const prisma = {
      broadcast: {
        findUnique: jest.fn().mockResolvedValue({
          id: "b1",
          status: BroadcastStatus.Cancelled,
          deliveries: [],
          notifications: [],
        }),
        update: jest.fn(),
      },
    };
    const { service } = buildService(prisma);
    const result = await service.executeAutoDispatch("b1");
    expect(result).toEqual(expect.objectContaining({ skipped: true, reason: "terminal_status" }));
    expect(prisma.broadcast.update.mock.calls.length).toBe(0);
  });

  it("rejects ambiguous local timestamps", () => {
    const { service } = buildService({});
    expect(() => (service as any).parseUtcTimestamp("2026-07-22T12:00:00", "scheduledAt")).toThrow(BadRequestException);
    expect(() => (service as any).parseUtcTimestamp("2026-07-22T12:00:00Z", "scheduledAt")).not.toThrow();
  });

  it("records dispatch queued audit with system actor", async () => {
    const { service, auditService } = buildService({});
    await service.recordDispatchQueued("b1", "broadcast:auto-dispatch:b1", false);
    expect(auditService.record.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        action: "broadcast.dispatch_queued",
        entityId: "b1",
        actor: BROADCAST_SYSTEM_ACTOR,
      }),
    );
  });
});

describe("BroadcastsService citizen feed", () => {
  it("returns paginated citizen feed payload", async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        {
          id: "b1",
          type: "Emergency",
          title: "Alert",
          body: "Body",
          priority: "P1LifeThreatening",
          published_at: new Date().toISOString(),
          expires_at: null,
          distance_meters: 1200,
          read: false,
        },
      ]),
    };
    const { service } = buildService(prisma);
    const result = await service.nearbyForUser("user-1", 6.5, 3.3, { limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: "b1",
        deepLink: "/broadcasts/b1",
        read: false,
      }),
    );
  });
});

describe("BroadcastQueueService enqueue", () => {
  it("uses deterministic broadcast auto-dispatch job ids", async () => {
    const { buildBroadcastAutoDispatchJobId } = await import("../../../common/queue/queue-jobs");
    expect(buildBroadcastAutoDispatchJobId("broadcast-1")).toBe("broadcast:auto-dispatch:broadcast-1");
  });
});
