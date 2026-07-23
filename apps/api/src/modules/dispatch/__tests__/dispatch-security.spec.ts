import { ForbiddenException } from "@nestjs/common";
import { AdminRoleName, IncidentAssignmentStatus, IncidentStatus } from "@the-eye/shared";
import { DispatchService } from "../dispatch.service";
import { IncidentTimelineService } from "../incident-timeline.service";

function buildDispatchService(overrides: Partial<Record<string, any>> = {}) {
  const prisma = {
    incident: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    incidentAssignment: { findFirst: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
    agency: { findUnique: jest.fn() },
    responder: { findUnique: jest.fn() },
    dispatchEvent: { create: jest.fn() },
    ...(overrides.prisma ?? {}),
  };
  const audit = { record: jest.fn() };
  const notifications = { create: jest.fn().mockResolvedValue({}) };
  const triageService = { evaluate: jest.fn() };
  const agencyRouting = { recommend: jest.fn().mockResolvedValue({ data: [], distanceSource: "haversine" }) };

  const service = new DispatchService(
    prisma as any,
    audit as any,
    notifications as any,
    triageService as any,
    agencyRouting as any,
  );

  return { service, prisma, audit, notifications };
}

describe("Dispatch security regressions", () => {
  const citizen = {
    sub: "user-1",
    typ: "user" as const,
    role: "Citizen",
    permissions: ["incident:create", "incident:read"],
  };

  const dispatcher = {
    sub: "admin-1",
    typ: "admin" as const,
    role: AdminRoleName.AgencyAdmin,
    agencyId: "agency-1",
    permissions: ["incident:read", "incident:assign", "incident:update", "incident:escalate"],
    country: "Nigeria",
    state: "Lagos",
    lga: "Ikeja",
  };

  it("blocks citizens from assigning incidents", async () => {
    const { service } = buildDispatchService();
    await expect(
      service.assignIncident("inc-1", { agencyId: "agency-1" }, citizen as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("blocks citizens from dispatch incident detail", async () => {
    const { service } = buildDispatchService();
    await expect(service.getIncident("inc-1", citizen as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("exposes silent indicator only to authorized dispatch readers", async () => {
    const { service, prisma } = buildDispatchService({
      prisma: {
        incidentAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      },
    });
    prisma.incident.findFirst.mockResolvedValue({
      id: "inc-1",
      reporterId: "user-1",
      isAnonymous: false,
      metadata: { silent: true, emergencyCategory: "SilentSos", triage: { priority: "P1LifeThreatening" } },
      submittedAt: new Date(),
      latitude: 6.5,
      longitude: 3.3,
      jurisdictionId: "jur-1",
      timeline: [],
      statusHistory: [],
      locationUpdates: [],
    });

    const detail = await service.getIncident("inc-1", dispatcher as any);
    expect(detail.data.silentIndicator).toBe(true);
  });

  it("reassigns only after marking the active assignment as Reassigned", async () => {
    const { service, prisma } = buildDispatchService({
      prisma: {
        incidentAssignment: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({
              id: "assign-1",
              status: IncidentAssignmentStatus.Assigned,
              version: 2,
              responderId: "resp-old",
              metadata: {},
            })
            .mockResolvedValueOnce(null),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          create: jest.fn().mockResolvedValue({
            id: "assign-2",
            status: IncidentAssignmentStatus.Assigned,
            agencyId: "agency-1",
            responderId: "resp-new",
          }),
        },
        responder: {
          findUnique: jest.fn().mockResolvedValue({
            id: "resp-new",
            agencyId: "agency-1",
            isActive: true,
            availability: "Available",
          }),
        },
      },
    });

    prisma.incident.findFirst.mockResolvedValue({
      id: "inc-1",
      status: IncidentStatus.Assigned,
      jurisdictionId: "jur-1",
      priority: "P1LifeThreatening",
      title: "Silent SOS",
    });
    prisma.agency.findUnique.mockResolvedValue({ id: "agency-1", jurisdictionId: "jur-1" });
    prisma.incident.update.mockResolvedValue({});

    await service.reassignIncident(
      "inc-1",
      {
        agencyId: "agency-1",
        responderId: "resp-new",
        reason: "Primary unit unavailable",
        clientAssignmentId: "client-reassign-1",
      },
      dispatcher as any,
    );

    expect(prisma.incidentAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "assign-1", version: 2 },
        data: expect.objectContaining({ status: IncidentAssignmentStatus.Reassigned }),
      }),
    );
  });
});

describe("IncidentTimelineService privacy", () => {
  it("filters dispatcher-only notes from citizen audience", async () => {
    const prisma = {
      incident: {
        findUnique: jest.fn().mockResolvedValue({
          id: "inc-1",
          reporterId: "user-1",
          isAnonymous: true,
          metadata: { silent: true },
          submittedAt: new Date(),
          updatedAt: new Date(),
          timeline: [],
          statusHistory: [],
          verifications: [],
          media: [],
          assignedAgency: null,
        }),
      },
      incidentAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      dispatchEvent: {
        findMany: jest.fn().mockResolvedValue([
          {
            createdAt: new Date(),
            eventType: "assignment.note",
            message: "Internal dispatcher note",
            metadata: { internal: true },
          },
        ]),
      },
    };
    const service = new IncidentTimelineService(prisma as any);
    const result = await service.buildTimeline("inc-1", "citizen", {
      sub: "user-1",
      typ: "user",
      permissions: ["incident:read"],
    } as any);
    expect(result.data.some((entry: { label?: string }) => entry.label === "Internal dispatcher note")).toBe(false);
  });
});
