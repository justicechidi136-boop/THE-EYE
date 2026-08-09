import { LiveVideoService } from "../live-video.service";

describe("LiveVideoService.reportClientJoinFailure", () => {
  function createService() {
    const prisma = {
      liveVideoSession: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      incidentTimeline: { create: jest.fn().mockResolvedValue({}) },
    };
    const livekitTokens = {};
    const config = { get: jest.fn() };
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const metrics = { observeLiveVideoStart: jest.fn(), increment: jest.fn() };
    const service = new LiveVideoService(
      prisma as never,
      livekitTokens as never,
      config as never,
      auditService as never,
      metrics as never,
    );
    return { prisma, auditService, service };
  }

  it("marks an active session Failed when the citizen join fails", async () => {
    const { prisma, auditService, service } = createService();
    prisma.liveVideoSession.findUnique.mockResolvedValueOnce({
      id: "sess-1",
      incidentId: "inc-1",
      createdById: "user-1",
      status: "Active",
      metadata: { role: "publisher" },
      incident: { id: "inc-1" },
    });
    prisma.liveVideoSession.update.mockResolvedValueOnce({
      id: "sess-1",
      status: "Failed",
    });

    const result = await service.reportClientJoinFailure(
      "sess-1",
      { typ: "user", sub: "user-1" } as never,
      { reasonCode: "LIVE-VIDEO-015", message: "ConnectException 502" },
    );

    expect(result.data.status).toBe("Failed");
    expect(prisma.liveVideoSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sess-1" },
        data: expect.objectContaining({ status: "Failed" }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "live_video.join_failed" }),
    );
  });

  it("rejects non-owner reporters", async () => {
    const { prisma, service } = createService();
    prisma.liveVideoSession.findUnique.mockResolvedValueOnce({
      id: "sess-1",
      createdById: "user-1",
      status: "Active",
      metadata: {},
      incident: { id: "inc-1" },
    });

    await expect(
      service.reportClientJoinFailure(
        "sess-1",
        { typ: "user", sub: "other-user" } as never,
        {},
      ),
    ).rejects.toThrow(/stream owner/);
  });
});
