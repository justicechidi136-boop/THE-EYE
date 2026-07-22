import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AdminRoleName, IncidentAssignmentStatus, IncidentStatus, ResponderAvailability } from "@the-eye/shared";
import { DispatchService } from "../dispatch.service";

function buildDispatchService(overrides: Partial<Record<string, any>> = {}) {
  const prisma = {
    incident: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    incidentEscalation: { create: jest.fn() },
    agency: { findUnique: jest.fn() },
    $queryRawUnsafe: jest.fn(),
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

describe("DispatchService", () => {
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

  it("prevents duplicate active assignments", async () => {
    const { service, prisma } = buildDispatchService({
      prisma: {
        incidentAssignment: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: "existing", status: IncidentAssignmentStatus.Assigned }),
        },
        responder: {
          findUnique: jest.fn().mockResolvedValue({
            id: "resp-1",
            agencyId: "agency-1",
            isActive: true,
            availability: ResponderAvailability.Available,
          }),
        },
      },
    });

    prisma.incident.findFirst.mockResolvedValue({
      id: "inc-1",
      status: IncidentStatus.Verified,
      jurisdictionId: "jur-1",
      priority: "P1LifeThreatening",
      title: "SOS",
    });
    prisma.agency.findUnique.mockResolvedValue({ id: "agency-1", jurisdictionId: "jur-1" });

    await expect(
      service.assignIncident(
        "inc-1",
        { agencyId: "agency-1", responderId: "resp-1", clientAssignmentId: "assign-1" },
        dispatcher as any,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("returns duplicate assignment by clientAssignmentId", async () => {
    const existing = { id: "assignment-1", clientAssignmentId: "assign-dup" };
    const { service, prisma } = buildDispatchService({
      prisma: {
        incidentAssignment: {
          findUnique: jest.fn().mockResolvedValue(existing),
        },
      },
    });

    const result = await service.assignIncident(
      "inc-1",
      { agencyId: "agency-1", responderId: "resp-1", clientAssignmentId: "assign-dup" },
      dispatcher as any,
    );
    expect(result.duplicate).toBe(true);
    expect(result.data).toEqual(existing);
    expect(prisma.incident.findFirst).not.toHaveBeenCalled();
  });

  it("enforces optimistic locking on assignment update", async () => {
    const { service, prisma } = buildDispatchService({
      prisma: {
        incidentAssignment: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce({
              id: "assignment-1",
              status: IncidentAssignmentStatus.Assigned,
              version: 2,
              agencyId: "agency-1",
              incident: { id: "inc-1", status: IncidentStatus.Assigned, reporterId: "user-1", isAnonymous: false },
              responder: { userId: "resp-user-1", adminUserId: "admin-resp-1" },
            })
            .mockResolvedValueOnce({
              id: "assignment-1",
              status: IncidentAssignmentStatus.Accepted,
              version: 3,
              agencyId: "agency-1",
              incident: { id: "inc-1", status: IncidentStatus.Responding, reporterId: "user-1", isAnonymous: false },
              responder: { userId: "resp-user-1", adminUserId: "admin-resp-1" },
            }),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        responder: { update: jest.fn() },
      },
    });

    await expect(
      service.updateAssignment(
        "assignment-1",
        { status: IncidentAssignmentStatus.Accepted, version: 2 },
        { sub: "resp-user-1", typ: "user", role: "responder", permissions: ["incident:update"] } as any,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("enqueues notifications when assignment is accepted", async () => {
    const { service, prisma, notifications } = buildDispatchService({
      prisma: {
        incidentAssignment: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce({
              id: "assignment-1",
              status: IncidentAssignmentStatus.Assigned,
              version: 1,
              agencyId: "agency-1",
              incidentId: "inc-1",
              incident: { id: "inc-1", status: IncidentStatus.Assigned, reporterId: "user-1", isAnonymous: false, title: "Medical SOS" },
              responder: { userId: "resp-user-1" },
            })
            .mockResolvedValueOnce({
              id: "assignment-1",
              status: IncidentAssignmentStatus.Accepted,
              version: 2,
              agencyId: "agency-1",
              incidentId: "inc-1",
              incident: { id: "inc-1", status: IncidentStatus.Assigned, reporterId: "user-1", isAnonymous: false, title: "Medical SOS" },
              responder: { userId: "resp-user-1" },
            }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        incident: { update: jest.fn().mockResolvedValue({}) },
        dispatchEvent: { create: jest.fn().mockResolvedValue({}) },
        responder: { update: jest.fn().mockResolvedValue({}) },
      },
    });

    await service.updateAssignment(
      "assignment-1",
      { status: IncidentAssignmentStatus.Accepted, version: 1 },
      { sub: "resp-user-1", typ: "user", role: "responder", permissions: ["incident:update"] } as any,
    );

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: "IncidentStatusUpdate",
        incidentId: "inc-1",
      }),
    );
  });

  it("blocks oversight auditor dispatch assignment", async () => {
    const { service } = buildDispatchService();
    await expect(
      service.assignIncident(
        "inc-1",
        { agencyId: "agency-1", responderId: "resp-1" },
        {
          sub: "auditor-1",
          typ: "admin",
          role: AdminRoleName.OversightAuditor,
          permissions: ["incident:read", "incident:assign"],
        } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("updates responder availability", async () => {
    const { service, prisma } = buildDispatchService({
      prisma: {
        responder: {
          findUnique: jest.fn().mockResolvedValue({ id: "resp-1", agencyId: "agency-1", userId: "resp-user-1" }),
          update: jest.fn().mockResolvedValue({ id: "resp-1", availability: ResponderAvailability.Available }),
        },
      },
    });

    const result = await service.updateResponderStatus(
      "resp-1",
      { availability: ResponderAvailability.Available },
      { sub: "resp-user-1", typ: "user", role: "responder", permissions: ["incident:update"] } as any,
    );

    expect(result.data.availability).toBe(ResponderAvailability.Available);
    expect(prisma.responder.update).toHaveBeenCalled();
  });

  it("rejects assignment acceptance after timeout", async () => {
    const { service, prisma } = buildDispatchService({
      prisma: {
        incidentAssignment: {
          findUnique: jest.fn().mockResolvedValue({
            id: "assignment-1",
            status: IncidentAssignmentStatus.Assigned,
            version: 1,
            expiresAt: new Date(Date.now() - 60_000),
            agencyId: "agency-1",
            incident: { id: "inc-1", status: IncidentStatus.Assigned, reporterId: "user-1", isAnonymous: false },
            responder: { userId: "resp-user-1" },
          }),
        },
      },
    });

    await expect(
      service.updateAssignment(
        "assignment-1",
        { status: IncidentAssignmentStatus.Accepted, version: 1 },
        { sub: "resp-user-1", typ: "user", role: "responder", permissions: ["incident:update"] } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns duplicate assignment action by clientActionId", async () => {
    const existingAssignment = {
      id: "assignment-1",
      status: IncidentAssignmentStatus.Accepted,
      version: 2,
      agencyId: "agency-1",
      incident: { id: "inc-1", status: IncidentStatus.Responding },
      responder: { userId: "resp-user-1" },
    };
    const { service, prisma } = buildDispatchService({
      prisma: {
        dispatchEvent: {
          findFirst: jest.fn().mockResolvedValue({ id: "evt-1", eventType: "assignment.accepted" }),
        },
        incidentAssignment: {
          findUnique: jest.fn().mockResolvedValue(existingAssignment),
          updateMany: jest.fn(),
        },
      },
    });

    const result = await service.updateAssignment(
      "assignment-1",
      {
        status: IncidentAssignmentStatus.Accepted,
        version: 2,
        clientActionId: "action-dup-1",
      },
      { sub: "resp-user-1", typ: "user", role: "responder", permissions: ["incident:update"] } as any,
    );

    expect(result.duplicate).toBe(true);
    expect(result.data).toEqual(existingAssignment);
    expect(prisma.incidentAssignment.updateMany).not.toHaveBeenCalled();
  });

  it("blocks responder from reading another responder assignment", async () => {
    const { service, prisma } = buildDispatchService({
      prisma: {
        incidentAssignment: {
          findUnique: jest.fn().mockResolvedValue({
            id: "assignment-1",
            agencyId: "agency-1",
            responder: { userId: "other-responder" },
            incident: { id: "inc-1" },
          }),
        },
      },
    });

    await expect(
      service.getAssignment("assignment-1", {
        sub: "resp-user-1",
        typ: "user",
        role: "responder",
        permissions: ["incident:read"],
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.incidentAssignment.findUnique).toHaveBeenCalled();
  });

  it("resolves responder profile from authenticated session", async () => {
    const { service, prisma } = buildDispatchService({
      prisma: {
        responder: {
          findFirst: jest.fn().mockResolvedValue({
            id: "resp-1",
            displayName: "Unit 12",
            agencyId: "agency-1",
            userId: "resp-user-1",
          }),
        },
      },
    });

    const result = await service.getResponderMe({
      sub: "resp-user-1",
      typ: "user",
      role: "responder",
      permissions: ["incident:read"],
    } as any);

    expect(result.data.id).toBe("resp-1");
    expect(prisma.responder.findFirst).toHaveBeenCalled();
  });

  it("throws when session has no responder profile", async () => {
    const { service, prisma } = buildDispatchService({
      prisma: {
        responder: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      },
    });

    await expect(
      service.getResponderMe({
        sub: "user-no-responder",
        typ: "user",
        role: "responder",
        permissions: ["incident:read"],
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
