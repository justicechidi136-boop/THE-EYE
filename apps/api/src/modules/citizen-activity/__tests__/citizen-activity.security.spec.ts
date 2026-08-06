import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { CitizenActivityService } from "../citizen-activity.service";

function buildService(overrides: Partial<Record<string, unknown>> = {}) {
  const prisma = {
    incident: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
    broadcast: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
    notification: { groupBy: jest.fn().mockResolvedValue([]) },
    auditLog: { count: jest.fn().mockResolvedValue(0) },
    liveVideoSession: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ count: 0n }]),
    ...(overrides.prisma as object),
  };
  const incidentTimeline = {
    buildTimeline: jest.fn().mockResolvedValue({ data: [] }),
    ...(overrides.incidentTimeline as object),
  };
  const communityVerification = {
    getIncidentAggregate: jest.fn().mockResolvedValue({ requestsSent: 0, responsesReceived: 0 }),
    ...(overrides.communityVerification as object),
  };
  return {
    service: new CitizenActivityService(prisma as any, incidentTimeline as any, communityVerification as any),
    prisma,
  };
}

describe("CitizenActivityService security", () => {
  const citizenA = { typ: "user", sub: "user-a", permissions: ["incident:read"] } as const;
  const citizenB = { typ: "user", sub: "user-b", permissions: ["incident:read"] } as const;

  it("scopes incident archive lookup to reporterId", async () => {
    const { service, prisma } = buildService();
    prisma.incident.findFirst.mockResolvedValue(null);
    await expect(service.getIncidentArchive("inc-secret", citizenB as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.incident.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "inc-secret", reporterId: "user-b" } }),
    );
  });

  it("scopes broadcast archive lookup to creatorUserId", async () => {
    const { service, prisma } = buildService();
    prisma.broadcast.findFirst.mockResolvedValue(null);
    await expect(service.getBroadcastArchive("bc-secret", citizenA as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.broadcast.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "bc-secret", creatorUserId: "user-a", deletedAt: null } }),
    );
  });

  it("rejects admin callers on unified history", async () => {
    const { service } = buildService();
    await expect(
      service.listActivityHistory({ typ: "admin", sub: "admin-1", permissions: ["incident:read"] } as any, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
