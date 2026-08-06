import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { AdminRoleName } from "@the-eye/shared";
import { IncidentCommunicationsAccessService } from "../incident-communications-access.service";

function createAccessService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    incident: { findUnique: jest.fn() },
    communityVerificationResponse: { findFirst: jest.fn() },
    responder: { findFirst: jest.fn() },
    incidentAssignment: { findFirst: jest.fn() },
    ...overrides,
  };
  const service = Object.create(IncidentCommunicationsAccessService.prototype) as IncidentCommunicationsAccessService;
  Object.assign(service, { prisma });
  return { service, prisma };
}

describe("IncidentCommunicationsAccessService", () => {
  const reporter = { typ: "user" as const, sub: "user-1", role: "Citizen", permissions: ["incident:read"] };
  const otherCitizen = { typ: "user" as const, sub: "user-2", role: "Citizen", permissions: ["incident:read"] };
  const dispatcher = {
    typ: "admin" as const,
    sub: "admin-1",
    role: AdminRoleName.CallCenterAgent,
    country: "NG",
    state: "LA",
    lga: "Ikeja",
    permissions: ["incident:read", "incident:update"],
  };
  const incident = {
    id: "inc-1",
    reporterId: "user-1",
    status: "Active",
    assignedAgencyId: "agency-1",
    country: "NG",
    state: "LA",
    lga: "Ikeja",
    metadata: { reportingMode: "identified" },
  };

  it("allows reporter access to own incident", async () => {
    const { service, prisma } = createAccessService();
    prisma.incident.findUnique.mockResolvedValue(incident);
    const access = await service.resolveAccess("inc-1", reporter);
    expect(access.role).toBe("Reporter");
    expect(access.canRead).toBe(true);
    expect(access.canWrite).toBe(true);
  });

  it("denies other citizen with 404 semantics", async () => {
    const { service, prisma } = createAccessService();
    prisma.incident.findUnique.mockResolvedValue(incident);
    prisma.communityVerificationResponse.findFirst.mockResolvedValue(null);
    const access = await service.resolveAccess("inc-1", otherCitizen);
    expect(access.canRead).toBe(false);
    await expect(service.assertAccess("inc-1", otherCitizen)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("denies community verifier who is not reporter", async () => {
    const { service, prisma } = createAccessService();
    prisma.incident.findUnique.mockResolvedValue(incident);
    prisma.communityVerificationResponse.findFirst.mockResolvedValue({ id: "cv-1" });
    const access = await service.resolveAccess("inc-1", otherCitizen);
    expect(access.canRead).toBe(false);
  });

  it("allows jurisdiction-scoped dispatcher", async () => {
    const { service, prisma } = createAccessService();
    prisma.incident.findUnique.mockResolvedValue(incident);
    const access = await service.resolveAccess("inc-1", dispatcher);
    expect(access.role).toBe("Dispatcher");
    expect(access.canModerate).toBe(true);
  });

  it("denies out-of-scope dispatcher", async () => {
    const { service, prisma } = createAccessService();
    prisma.incident.findUnique.mockResolvedValue({ ...incident, lga: "Other" });
    const access = await service.resolveAccess("inc-1", dispatcher);
    expect(access.canRead).toBe(false);
  });

  it("allows assigned responder", async () => {
    const { service, prisma } = createAccessService();
    prisma.incident.findUnique.mockResolvedValue(incident);
    prisma.responder.findFirst.mockResolvedValue({ id: "resp-1", agencyId: "agency-1", displayName: "Unit 12" });
    prisma.incidentAssignment.findFirst.mockResolvedValue({ id: "asg-1" });
    const access = await service.resolveAccess("inc-1", {
      typ: "user",
      sub: "resp-user",
      role: "responder",
      permissions: ["incident:read"],
    });
    expect(access.role).toBe("Responder");
    expect(access.canWrite).toBe(true);
  });
});
