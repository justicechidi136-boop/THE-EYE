import { AdminRoleName } from "@the-eye/shared";
import { LiveVideoService } from "../live-video.service";

describe("LiveVideoService.sessionOverview", () => {
  it("returns the incident-linked session after a client join failure with authoritative counts", async () => {
    const failedSession = {
      id: "session-1",
      incidentId: "incident-1",
      roomName: "eye-incident-incident-1",
      status: "Failed",
      startedAt: new Date("2026-08-30T10:00:00.000Z"),
      incident: {
        id: "incident-1",
        country: "Nigeria",
        state: "Rivers",
        lga: "Obio-Akpor",
        reporter: null,
      },
      locationUpdates: [],
    };
    const prisma = {
      liveVideoSession: {
        findMany: jest.fn().mockResolvedValue([failedSession]),
        count: jest.fn().mockResolvedValueOnce(12).mockResolvedValueOnce(2),
      },
    } as any;
    const service = new LiveVideoService(
      prisma,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.sessionOverview({
      typ: "admin",
      sub: "admin-1",
      role: AdminRoleName.StateAdmin,
      country: "Nigeria",
      state: "Rivers",
    } as never);

    expect(result.data[0].incidentId).toBe("incident-1");
    expect(result.data[0].incident.id).toBe("incident-1");
    expect(result.data[0].status).toBe("Failed");
    expect(result.meta.total).toBe(12);
    expect(result.meta.active).toBe(2);
    expect(prisma.liveVideoSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { incident: { country: "Nigeria", state: "Rivers" } },
      }),
    );
  });

  it("keeps the total stable when the returned operational row window changes", async () => {
    const prisma = {
      liveVideoSession: {
        findMany: jest.fn().mockResolvedValue([{ id: "latest-session" }]),
        count: jest.fn().mockResolvedValueOnce(245).mockResolvedValueOnce(4),
      },
    } as any;
    const service = new LiveVideoService(
      prisma,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.sessionOverview({
      typ: "admin",
      sub: "super-1",
      role: AdminRoleName.SuperAdmin,
    } as never);

    expect(result.data.length).toBe(1);
    expect(result.meta.returned).toBe(1);
    expect(result.meta.total).toBe(245);
    expect(result.meta.active).toBe(4);
  });
});
