import { ConfigService } from "@nestjs/config";
import { ForbiddenException } from "@nestjs/common";
import { createMetricsMock } from "../../../common/metrics/metrics.test-utils";
import { LiveVideoService } from "../live-video.service";

const superAdmin = { typ: "admin", sub: "admin-1", role: "Super Admin", email: "admin@theeye.local", permissions: ["incident:read"] } as any;
const scopedAdmin = { typ: "admin", sub: "admin-2", role: "LGA Admin", country: "Nigeria", state: "Lagos", lga: "Ikeja", permissions: ["incident:read"] } as any;
const wrongAdmin = { typ: "admin", sub: "admin-3", role: "LGA Admin", country: "Nigeria", state: "Lagos", lga: "Eti-Osa", permissions: ["incident:read"] } as any;

function buildService() {
  const latest = { id: "loc-1", latitude: 6.5244, longitude: 3.3792, accuracy: 8, capturedAt: new Date("2026-07-06T08:34:22.000Z") };
  const session = {
    id: "session-1",
    incidentId: "incident-1",
    roomName: "eye-incident-1",
    locationUpdates: [latest],
    incident: { id: "INC-2026-000123", isAnonymous: true, reporterId: "user-1", country: "Nigeria", state: "Lagos", lga: "Ikeja", assignedAgencyId: null },
  };
  const prisma = {
    liveVideoSession: { findUnique: jest.fn().mockResolvedValue(session) },
    incident: { findUnique: jest.fn().mockResolvedValue(session.incident) },
    auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) },
    incidentTimeline: { create: jest.fn() },
    liveVideoLocationUpdate: { create: jest.fn(), findMany: jest.fn() },
  } as any;
  const tokens = { livekitUrl: jest.fn(), createToken: jest.fn() } as any;
  const config = { get: jest.fn((key: string, fallback: string) => key === "LIVE_LOCATION_LINK_SECRET" ? "secret" : fallback) } as unknown as ConfigService;
  const auditService = { record: jest.fn().mockResolvedValue({ id: "audit-1" }) } as any;
  return { service: new LiveVideoService(prisma, tokens, config, auditService, createMetricsMock()), prisma, auditService };
}

describe("LiveVideoService live location security", () => {
  it("hides reporter identity for anonymous incidents in admin overlay", async () => {
    const { service } = buildService();
    const result = await service.latestLocation("session-1", superAdmin);
    expect(result.evidenceOverlay.reporter).toMatch(/^Anonymous-/);
    expect(result.evidenceOverlay.reporter).not.toContain("user-1");
  });

  it("blocks unauthorized admins from live location", async () => {
    const { service } = buildService();
    await expect(service.latestLocation("session-1", wrongAdmin)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("creates audit log when authorized admin opens signed live location", async () => {
    const { service, auditService } = buildService();
    const latest = await service.latestLocation("session-1", scopedAdmin);
    const token = latest.signedOpenLocationUrl!.split("/").pop()!;
    const result = await service.openLiveLocation("session-1", token, scopedAdmin);

    expect(result.data.googleMaps).toContain("6.5244,3.3792");
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({
      action: "live_video.location_opened",
    }));
  });

  it("rejects admin view tokens for inactive sessions", async () => {
    const { service, prisma } = buildService();
    prisma.liveVideoSession.findUnique.mockResolvedValueOnce({
      id: "session-1",
      incidentId: "incident-1",
      roomName: "eye-incident-1",
      status: "Ended",
      locationUpdates: [],
      incident: { id: "INC-2026-000123", country: "Nigeria", state: "Lagos", lga: "Ikeja", assignedAgencyId: null },
    });
    await expect(service.adminViewToken("session-1", superAdmin)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
