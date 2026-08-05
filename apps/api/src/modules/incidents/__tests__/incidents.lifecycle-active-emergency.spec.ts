import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  AdminRoleName,
  IncidentAssignmentStatus,
  IncidentStatus,
  ResolutionSource,
} from "@the-eye/shared";
import { ActiveEmergencyService } from "../active-emergency.service";
import { IncidentsService } from "../incidents.service";
import {
  allowedIncidentTransitions,
  canActorTransitionIncident,
  canReporterCancelDirectly,
  canReporterRequestCancellation,
  canTransitionIncident,
  isActiveIncidentStatus,
  isTerminalIncidentStatus,
} from "../incident-lifecycle";
import { buildIncidentPresentation, TERMINAL_ROUTE_TYPE } from "../incident-presentation.mapper";

const reporter = { sub: "user-1", typ: "user" as const, permissions: ["incident:create", "incident:read"] };
const otherCitizen = { sub: "user-2", typ: "user" as const, permissions: ["incident:read"] };
const lgaAdmin = {
  sub: "admin-1",
  typ: "admin" as const,
  role: AdminRoleName.LgaAdmin,
  country: "Nigeria",
  state: "Lagos",
  lga: "Ikeja",
  permissions: ["incident:read", "incident:update"],
};
const stateAdmin = {
  sub: "admin-2",
  typ: "admin" as const,
  role: AdminRoleName.StateAdmin,
  country: "Nigeria",
  state: "Abuja",
  permissions: ["incident:read", "incident:update"],
};

function buildIncidentsService(overrides: Record<string, unknown> = {}) {
  const incidentUpdate = jest.fn().mockImplementation(async ({ data }: any) => ({
    id: "inc-1",
    status: data.status ?? IncidentStatus.Submitted,
    statusVersion: 2,
    reporterId: "user-1",
    ...data,
  }));
  const prisma = {
    incident: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: incidentUpdate,
    },
    ...(overrides.prisma as object),
  } as any;

  const deps = {
    prisma,
    audit: { record: jest.fn().mockResolvedValue({ id: "audit-1" }) },
    metrics: { recordIncidentSubmission: jest.fn() },
    verification: { verifyIncident: jest.fn() },
    notifications: { enqueue: jest.fn().mockResolvedValue({ jobId: "job-1" }) },
    dispatchService: {},
    emergencyClassification: {},
    locationTracking: {},
    locationRetry: {},
    incidentTimeline: {},
    etaService: {},
    jurisdictionResolution: {},
    voiceTranscription: {},
    ...(overrides.deps as object),
  };

  const service = new IncidentsService(
    deps.prisma,
    deps.audit as any,
    deps.metrics as any,
    deps.verification as any,
    deps.notifications as any,
    deps.dispatchService as any,
    deps.emergencyClassification as any,
    deps.locationTracking as any,
    deps.locationRetry as any,
    deps.incidentTimeline as any,
    deps.etaService as any,
    deps.jurisdictionResolution as any,
    deps.voiceTranscription as any,
  );

  return { service, prisma, audit: deps.audit, notifications: deps.notifications, incidentUpdate };
}

function buildActiveEmergencyService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    incident: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    ...(overrides.prisma as object),
  } as any;
  const incidentsService = {
    get: jest.fn().mockResolvedValue({ id: "inc-1", reporterId: "user-1", status: IncidentStatus.Verified }),
    ...(overrides.incidentsService as object),
  } as any;
  const service = new ActiveEmergencyService(prisma, incidentsService);
  return { service, prisma, incidentsService };
}

describe("incident lifecycle contract", () => {
  it("defines the authoritative main-path transitions", () => {
    expect(canTransitionIncident(IncidentStatus.Submitted, IncidentStatus.Received)).toBe(true);
    expect(canTransitionIncident(IncidentStatus.Received, IncidentStatus.Verifying)).toBe(true);
    expect(canTransitionIncident(IncidentStatus.Verifying, IncidentStatus.Verified)).toBe(true);
    expect(canTransitionIncident(IncidentStatus.Verified, IncidentStatus.Assigned)).toBe(true);
    expect(canTransitionIncident(IncidentStatus.Assigned, IncidentStatus.Responding)).toBe(true);
    expect(canTransitionIncident(IncidentStatus.Responding, IncidentStatus.UnderControl)).toBe(true);
    expect(canTransitionIncident(IncidentStatus.UnderControl, IncidentStatus.Resolved)).toBe(true);
    expect(canTransitionIncident(IncidentStatus.Resolved, IncidentStatus.Closed)).toBe(true);
  });

  it("rejects invalid Closed transition from pre-Resolved states", () => {
    for (const status of [
      IncidentStatus.Submitted,
      IncidentStatus.Received,
      IncidentStatus.Verifying,
      IncidentStatus.Verified,
      IncidentStatus.Assigned,
    ]) {
      expect(canTransitionIncident(status, IncidentStatus.Closed)).toBe(false);
    }
  });

  it("maps progress and allowed actions for each lifecycle state", () => {
    for (const status of Object.values(IncidentStatus)) {
      const presentation = buildIncidentPresentation({ status, reporterId: "user-1" }, reporter);
      expect(typeof presentation.displayLabel).toBe("string");
      expect(presentation.displayLabel.length).toBeGreaterThan(0);
      expect(typeof presentation.isTerminal).toBe("boolean");
      expect(typeof presentation.isActive).toBe("boolean");
      expect(presentation.progressStages.length).toBeGreaterThan(0);
      expect(typeof presentation.allowedActions.addEvidence).toBe("boolean");
      expect(typeof presentation.allowedActions.uploadPhoto).toBe("boolean");
      expect(typeof presentation.allowedActions.uploadVideo).toBe("boolean");
      expect(typeof presentation.allowedActions.uploadVoice).toBe("boolean");
      expect(typeof presentation.allowedActions.addUpdate).toBe("boolean");
      expect(typeof presentation.allowedActions.cancel).toBe("boolean");
      expect(typeof presentation.allowedActions.requestCancellation).toBe("boolean");
      expect(typeof presentation.allowedActions.confirmResolved).toBe("boolean");
      expect(typeof presentation.allowedActions.confirmStillOngoing).toBe("boolean");
    }
  });

  it("allows reporter direct cancel only before assignment", () => {
    expect(canReporterCancelDirectly(IncidentStatus.Submitted)).toBe(true);
    expect(canReporterCancelDirectly(IncidentStatus.Verifying)).toBe(true);
    expect(canReporterCancelDirectly(IncidentStatus.Verified)).toBe(true);
    expect(canReporterCancelDirectly(IncidentStatus.Assigned)).toBe(false);
  });

  it("allows reporter cancellation request after assignment", () => {
    expect(canReporterRequestCancellation(IncidentStatus.Assigned)).toBe(true);
    expect(canReporterRequestCancellation(IncidentStatus.Responding)).toBe(true);
    expect(canReporterRequestCancellation(IncidentStatus.UnderControl)).toBe(true);
    expect(canReporterRequestCancellation(IncidentStatus.Verified)).toBe(false);
  });

  it("restricts citizen transitions to cancellation actions", () => {
    expect(canActorTransitionIncident(reporter, IncidentStatus.Submitted, IncidentStatus.CancelledByReporter)).toBe(true);
    expect(canActorTransitionIncident(reporter, IncidentStatus.Assigned, IncidentStatus.CancellationRequested)).toBe(true);
    expect(canActorTransitionIncident(reporter, IncidentStatus.Submitted, IncidentStatus.Closed)).toBe(false);
    expect(canActorTransitionIncident(reporter, IncidentStatus.UnderControl, IncidentStatus.Resolved)).toBe(false);
  });

  it("marks terminal and active sets consistently", () => {
    expect(isTerminalIncidentStatus(IncidentStatus.Closed)).toBe(true);
    expect(isTerminalIncidentStatus(IncidentStatus.CancelledByReporter)).toBe(true);
    expect(isActiveIncidentStatus(IncidentStatus.Responding)).toBe(true);
    expect(isActiveIncidentStatus(IncidentStatus.Closed)).toBe(false);
  });

  it("keeps every enum value in the transition matrix", () => {
    for (const status of Object.values(IncidentStatus)) {
      expect(Array.isArray(allowedIncidentTransitions[status])).toBe(true);
    }
  });
});

describe("IncidentsService cancellation and lifecycle", () => {
  const baseIncident = {
    id: "inc-1",
    reporterId: "user-1",
    statusVersion: 1,
    statusHistory: [],
  };

  it("cancels from Submitted to CancelledByReporter", async () => {
    const { service, prisma, audit, incidentUpdate } = buildIncidentsService();
    prisma.incident.findFirst.mockResolvedValue({ ...baseIncident, status: IncidentStatus.Submitted });

    const result = await service.cancelEmergency("inc-1", "False alarm", reporter);

    expect(incidentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inc-1" },
        data: expect.objectContaining({ status: IncidentStatus.CancelledByReporter }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "incident.cancelled_by_reporter" }),
    );
    expect(result.status).toBe(IncidentStatus.CancelledByReporter);
  });

  it("cancels from Verifying to CancelledByReporter", async () => {
    const { service, prisma } = buildIncidentsService();
    prisma.incident.findFirst.mockResolvedValue({ ...baseIncident, status: IncidentStatus.Verifying });

    const result = await service.cancelEmergency("inc-1", "Mistake", reporter);
    expect(result.status).toBe(IncidentStatus.CancelledByReporter);
  });

  it("cancels from Verified to CancelledByReporter", async () => {
    const { service, prisma } = buildIncidentsService();
    prisma.incident.findFirst.mockResolvedValue({ ...baseIncident, status: IncidentStatus.Verified });

    const result = await service.cancelEmergency("inc-1", "Mistake", reporter);
    expect(result.status).toBe(IncidentStatus.CancelledByReporter);
  });

  it("creates CancellationRequested from Assigned", async () => {
    const { service, prisma, audit } = buildIncidentsService();
    prisma.incident.findFirst.mockResolvedValue({ ...baseIncident, status: IncidentStatus.Assigned });

    const result = await service.requestCancellation("inc-1", "Situation handled", reporter);

    expect(result.status).toBe(IncidentStatus.CancellationRequested);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "incident.cancellation_requested" }),
    );
  });

  it("creates CancellationRequested from Responding", async () => {
    const { service, prisma } = buildIncidentsService();
    prisma.incident.findFirst.mockResolvedValue({ ...baseIncident, status: IncidentStatus.Responding });

    const result = await service.requestCancellation("inc-1", "All clear now", reporter);
    expect(result.status).toBe(IncidentStatus.CancellationRequested);
  });

  it("rejects direct cancel on Assigned and directs to request-cancellation", async () => {
    const { service, prisma } = buildIncidentsService();
    prisma.incident.findFirst.mockResolvedValue({ ...baseIncident, status: IncidentStatus.Assigned });

    await expect(service.cancelEmergency("inc-1", "No longer needed", reporter)).rejects.toThrow(BadRequestException);
  });

  it("rejects duplicate cancellation requests", async () => {
    const { service, prisma } = buildIncidentsService();
    prisma.incident.findFirst.mockResolvedValue({
      ...baseIncident,
      status: IncidentStatus.Assigned,
      cancellationRequestedAt: new Date(),
    });

    await expect(service.requestCancellation("inc-1", "Again", reporter)).rejects.toThrow(BadRequestException);
  });

  it("returns idempotent response for already cancelled incidents", async () => {
    const { service, prisma, incidentUpdate } = buildIncidentsService();
    prisma.incident.findFirst.mockResolvedValue({
      ...baseIncident,
      status: IncidentStatus.CancelledByReporter,
      cancelledAt: new Date(),
    });

    const result = await service.cancelEmergency("inc-1", "Repeat", reporter);
    expect(incidentUpdate).not.toHaveBeenCalled();
    expect((result as Record<string, unknown>).duplicate).toBe(true);
  });

  it("rejects invalid Closed transition server-side", async () => {
    const { service, prisma } = buildIncidentsService();
    prisma.incident.findFirst.mockResolvedValue({ ...baseIncident, status: IncidentStatus.Verified });

    await expect(
      service.updateStatus("inc-1", IncidentStatus.Closed, "Trying to skip resolved", lgaAdmin),
    ).rejects.toThrow(BadRequestException);
  });

  it("records resolution source on Resolved transition", async () => {
    const { service, prisma, incidentUpdate } = buildIncidentsService();
    prisma.incident.findFirst.mockResolvedValue({ ...baseIncident, status: IncidentStatus.UnderControl });

    await service.updateStatus("inc-1", IncidentStatus.Resolved, "Agency cleared scene", lgaAdmin);

    expect(incidentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: IncidentStatus.Resolved,
          resolutionSource: ResolutionSource.Administrator,
        }),
      }),
    );
  });

  it("increments status version on transition", async () => {
    const { service, prisma, incidentUpdate } = buildIncidentsService();
    prisma.incident.findFirst.mockResolvedValue({ ...baseIncident, status: IncidentStatus.Submitted });

    await service.cancelEmergency("inc-1", "False alarm", reporter);

    expect(incidentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statusVersion: { increment: 1 } }),
      }),
    );
  });

  it("creates timeline and audit events on cancel", async () => {
    const { service, prisma, audit, incidentUpdate } = buildIncidentsService();
    prisma.incident.findFirst.mockResolvedValue({ ...baseIncident, status: IncidentStatus.Submitted });

    await service.cancelEmergency("inc-1", "False alarm", reporter);

    expect(incidentUpdate.mock.calls[0][0].data.timeline.create.eventType).toBe("incident.cancelled_by_reporter");
    expect(audit.record).toHaveBeenCalled();
  });

  it("keeps cancelled incidents retrievable via get", async () => {
    const { service, prisma } = buildIncidentsService();
    prisma.incident.findFirst.mockResolvedValue({
      ...baseIncident,
      status: IncidentStatus.CancelledByReporter,
      cancellationReason: "False alarm",
    });

    const incident = await service.get("inc-1", reporter);
    expect(incident.status).toBe(IncidentStatus.CancelledByReporter);
  });

  it("enforces cross-jurisdiction admin restrictions", async () => {
    const { service, prisma } = buildIncidentsService();
    prisma.incident.findFirst.mockResolvedValue(null);

    await expect(service.get("inc-1", stateAdmin)).rejects.toThrow(NotFoundException);
  });

  it("forbids another citizen from cancelling", async () => {
    const { service, prisma } = buildIncidentsService();
    prisma.incident.findFirst.mockResolvedValue(null);

    await expect(service.cancelEmergency("inc-1", "Nope", otherCitizen)).rejects.toThrow(NotFoundException);
  });
});

describe("ActiveEmergencyService contract", () => {
  const activeIncident = {
    id: "inc-1",
    reporterId: "user-1",
    status: IncidentStatus.Verified,
    statusVersion: 3,
    type: "Emergency",
    title: "Help needed",
    description: "Smoke in building",
    submittedAt: new Date("2026-08-05T10:00:00.000Z"),
    updatedAt: new Date("2026-08-05T10:05:00.000Z"),
    latitude: "6.6018",
    longitude: "3.3515",
    address: "Ikeja",
    manualLocationAdjusted: false,
    liveLocationStale: false,
    liveLocationUpdatedAt: null,
    metadata: {},
    media: [],
    statusHistory: [],
    timeline: [],
    assignments: [],
    liveVideoSessions: [],
    verifications: [],
    assignedAgency: null,
  };

  it("allows reporter to read own active emergency", async () => {
    const { service, prisma } = buildActiveEmergencyService();
    prisma.incident.findFirst.mockResolvedValue({ id: "inc-1" });
    prisma.incident.findUnique.mockResolvedValue(activeIncident);

    const result = await service.getActiveEmergency("inc-1", reporter);

    expect(result.isActive).toBe(true);
    expect(result.routeType).toBe("OWN_ACTIVE_INCIDENT");
    expect(result.incidentId).toBe("inc-1");
    expect(result.allowedActions.cancel).toBe(true);
  });

  it("denies another citizen with 404", async () => {
    const { service, prisma } = buildActiveEmergencyService();
    prisma.incident.findFirst.mockResolvedValue(null);

    await expect(service.getActiveEmergency("inc-1", otherCitizen)).rejects.toThrow(NotFoundException);
  });

  it("allows admin access through scoped get", async () => {
    const { service, prisma, incidentsService } = buildActiveEmergencyService();
    incidentsService.get.mockResolvedValue(activeIncident);
    prisma.incident.findUnique.mockResolvedValue(activeIncident);

    const result = await service.getActiveEmergency("inc-1", lgaAdmin);
    expect(result.isActive).toBe(true);
    expect(incidentsService.get).toHaveBeenCalledWith("inc-1", lgaAdmin);
  });

  it("returns terminal redirect contract for resolved incidents", async () => {
    const { service, prisma } = buildActiveEmergencyService();
    prisma.incident.findFirst.mockResolvedValue({ id: "inc-1" });
    prisma.incident.findUnique.mockResolvedValue({
      ...activeIncident,
      status: IncidentStatus.Resolved,
      resolvedAt: new Date(),
      resolutionSource: ResolutionSource.Agency,
    });

    const result = await service.getActiveEmergency("inc-1", reporter);

    expect(result.isActive).toBe(false);
    expect(result.routeType).toBe(TERMINAL_ROUTE_TYPE);
    expect(result.incidentId).toBe("inc-1");
    expect(result.resolutionSummary).toEqual(
      expect.objectContaining({ source: ResolutionSource.Agency }),
    );
  });

  it("derives allowed actions before assignment", async () => {
    const { service, prisma } = buildActiveEmergencyService();
    prisma.incident.findFirst.mockResolvedValue({ id: "inc-1" });
    prisma.incident.findUnique.mockResolvedValue(activeIncident);

    const result = await service.getActiveEmergency("inc-1", reporter);
    expect(result.allowedActions.cancel).toBe(true);
    expect(result.allowedActions.requestCancellation).toBe(false);
  });

  it("derives allowed actions after assignment", async () => {
    const { service, prisma } = buildActiveEmergencyService();
    prisma.incident.findFirst.mockResolvedValue({ id: "inc-1" });
    prisma.incident.findUnique.mockResolvedValue({
      ...activeIncident,
      status: IncidentStatus.Assigned,
      assignments: [
        {
          id: "assign-1",
          status: IncidentAssignmentStatus.Accepted,
          responder: { id: "resp-1", displayName: "Unit 12" },
          agency: { id: "agency-1", name: "Fire Service" },
        },
      ],
    });

    const result = await service.getActiveEmergency("inc-1", reporter);
    expect(result.allowedActions.cancel).toBe(false);
    expect(result.allowedActions.requestCancellation).toBe(true);
  });

  it("derives allowed actions when responders are on scene", async () => {
    const { service, prisma } = buildActiveEmergencyService();
    prisma.incident.findFirst.mockResolvedValue({ id: "inc-1" });
    prisma.incident.findUnique.mockResolvedValue({
      ...activeIncident,
      status: IncidentStatus.UnderControl,
      assignments: [
        {
          id: "assign-1",
          status: IncidentAssignmentStatus.Arrived,
          responder: { id: "resp-1", displayName: "Unit 12" },
          agency: { id: "agency-1", name: "Fire Service" },
        },
      ],
    });

    const result = await service.getActiveEmergency("inc-1", reporter);
    expect(result.allowedActions.confirmResolved).toBe(true);
    expect(result.allowedActions.confirmStillOngoing).toBe(true);
    expect(result.allowedActions.requestCancellation).toBe(true);
  });
});

describe("IncidentsService reporter status", () => {
  const baseIncident = {
    id: "inc-1",
    reporterId: "user-1",
    statusVersion: 1,
    metadata: {},
    statusHistory: [],
  };

  it("records StillOngoing for reporter owner", async () => {
    const { service, prisma, audit, incidentUpdate } = buildIncidentsService({
      prisma: {
        incidentAssignment: { findFirst: jest.fn().mockResolvedValue({ id: "a1" }) },
      },
    });
    prisma.incident.findFirst.mockResolvedValue({
      ...baseIncident,
      status: IncidentStatus.Responding,
    });
    incidentUpdate.mockResolvedValue({
      ...baseIncident,
      status: IncidentStatus.Responding,
      statusVersion: 2,
    });

    await service.submitReporterStatus(
      "inc-1",
      { status: "StillOngoing", note: "Still unsafe", clientActionId: "act-1" },
      reporter,
    );

    expect(incidentUpdate).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "incident.reporter_still_ongoing" }),
    );
  });

  it("rejects cross-user reporter status", async () => {
    const { service, prisma } = buildIncidentsService();
    prisma.incident.findFirst.mockResolvedValue(null);
    await expect(
      service.submitReporterStatus(
        "inc-1",
        { status: "Unsure", clientActionId: "act-2" },
        otherCitizen,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("is idempotent by clientActionId", async () => {
    const { service, prisma, incidentUpdate } = buildIncidentsService({
      prisma: {
        incidentAssignment: { findFirst: jest.fn().mockResolvedValue(null) },
      },
    });
    prisma.incident.findFirst.mockResolvedValue({
      ...baseIncident,
      status: IncidentStatus.Verified,
      metadata: {
        reporterStatusActions: {
          "act-dup": { status: "Unsure", recordedAt: new Date().toISOString() },
        },
      },
    });

    await service.submitReporterStatus(
      "inc-1",
      { status: "Unsure", clientActionId: "act-dup" },
      reporter,
    );
    expect(incidentUpdate).not.toHaveBeenCalled();
  });

  it("creates review signal for assigned Resolved reporter status", async () => {
    const { service, prisma, incidentUpdate } = buildIncidentsService({
      prisma: {
        incidentAssignment: {
          findFirst: jest.fn().mockResolvedValue({ id: "assign-1", status: "Accepted" }),
        },
      },
    });
    prisma.incident.findFirst.mockResolvedValue({
      ...baseIncident,
      status: IncidentStatus.Responding,
    });
    incidentUpdate.mockResolvedValue({
      ...baseIncident,
      status: IncidentStatus.Responding,
      statusVersion: 2,
    });

    await service.submitReporterStatus(
      "inc-1",
      { status: "Resolved", note: "Looks clear", clientActionId: "act-3" },
      reporter,
    );

    expect(incidentUpdate.mock.calls[0][0].data.timeline.create.eventType).toBe(
      "incident.reporter_resolution_signal",
    );
  });
});
