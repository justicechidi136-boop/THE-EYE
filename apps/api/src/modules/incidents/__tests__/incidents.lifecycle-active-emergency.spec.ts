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
import { getConfiguredStorageBucket } from "../../../common/storage/s3-presign";

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
  const communityVerification = {
    getIncidentAggregate: jest.fn().mockResolvedValue({
      requestsSent: 0,
      responsesReceived: 0,
      confirmedCount: 0,
      notFoundCount: 0,
      ongoingCount: 0,
      resolvedCount: 0,
      confidenceLevel: "Insufficient",
      conflictDetected: false,
      lastCommunityUpdateAt: null,
      safeSummaryText: "Community verification is in progress.",
      recommendation: "NONE",
      reviewRequired: false,
    }),
    ...(overrides.communityVerification as object),
  } as any;
  const incidentCommunications = {
    getCommunicationSummary: jest.fn().mockResolvedValue({
      conversationAvailable: true,
      unreadMessageCount: 0,
      lastMessagePreview: null,
      lastMessageAt: null,
      pendingInformationRequestCount: 0,
      conversationStatus: "Active",
      allowedCommunicationActions: {
        sendText: true,
        sendVoice: true,
        sendPhoto: true,
        sendVideo: true,
        sendLocation: true,
        quickReply: true,
        openThread: true,
      },
    }),
    ...(overrides.incidentCommunications as object),
  } as any;
  const service = new ActiveEmergencyService(
    prisma,
    incidentsService,
    communityVerification,
    incidentCommunications,
  );
  return { service, prisma, incidentsService, communityVerification, incidentCommunications };
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
    metadata: { locationAccuracyMeters: 12.5 },
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
    expect(result.reportedLocation.accuracyMeters).toBe(12.5);
    expect(result.reportedLocation.capturedAt).toEqual(
      new Date("2026-08-05T10:00:00.000Z").toISOString(),
    );
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

  it("returns confirmed image video and audio on the immediate active read", async () => {
    const bucket = getConfiguredStorageBucket();
    const mediaRows: any[] = [];
    const incidentMedia = {
      findUnique: jest.fn().mockImplementation(async ({ where }: any) =>
        mediaRows.find((item) => item.fileHash === where.fileHash) ?? null,
      ),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const media = {
          ...data,
          id: `media-${mediaRows.length + 1}`,
          uploadedAt: new Date(`2026-08-05T10:00:1${mediaRows.length}.000Z`),
        };
        mediaRows.push(media);
        return media;
      }),
    };
    const { service: incidents } = buildIncidentsService({
      prisma: {
        incident: {
          findFirst: jest.fn().mockResolvedValue(activeIncident),
        },
        incidentMedia,
        incidentTimeline: { create: jest.fn().mockResolvedValue({ id: "timeline-1" }) },
      },
      deps: {
        voiceTranscription: {
          enqueueIncidentMediaTranscription: jest.fn().mockResolvedValue(undefined),
        },
      },
    });
    const { service: active, prisma } = buildActiveEmergencyService();
    prisma.incident.findFirst.mockResolvedValue({ id: "inc-1" });
    prisma.incident.findUnique.mockImplementation(async () => ({
      ...activeIncident,
      media: [...mediaRows],
    }));

    const drafts = [
      {
        mediaType: "Image",
        contentType: "image/jpeg",
        objectKey: "evidence/inc-1/11111111-1111-4111-8111-111111111111.jpg",
        fileHash: "sha256:image",
        sizeBytes: 2048,
      },
      {
        mediaType: "Video",
        contentType: "video/mp4",
        objectKey: "evidence/inc-1/22222222-2222-4222-8222-222222222222.mp4",
        fileHash: "sha256:video",
        durationSeconds: 24,
      },
      {
        mediaType: "Audio",
        contentType: "audio/mp4",
        objectKey: "evidence/inc-1/33333333-3333-4333-8333-333333333333.m4a",
        fileHash: "sha256:audio",
        durationSeconds: 12,
      },
    ];

    const confirmedRows = [];
    for (const draft of drafts) {
      confirmedRows.push(await incidents.confirmMedia(
        "inc-1",
        {
          ...draft,
          bucket,
          capturedAt: "2026-08-05T10:00:00.000Z",
          clientAttachmentId: `client-${draft.mediaType.toLowerCase()}`,
        } as any,
        reporter,
      ));
    }

    expect(incidentMedia.create.mock.calls[0]?.[0].data.sizeBytes).toBe(BigInt(2048));
    expect(confirmedRows[0].sizeBytes).toBe(2048);
    expect(JSON.stringify(confirmedRows[0])).toContain('"sizeBytes":2048');

    const result = await active.getActiveEmergency("inc-1", reporter);
    expect(result.evidenceItems.length).toBe(3);
    expect(result.evidenceSummary.totalCount).toBe(3);
    expect(result.evidenceSummary.photos).toBe(1);
    expect(result.evidenceSummary.videos).toBe(1);
    expect(result.evidenceSummary.voice).toBe(1);
    expect(result.statusVersion).toBe(activeIncident.statusVersion);
    expect(result.lastUpdatedAt).toBe(activeIncident.updatedAt.toISOString());
  });

  it("returns the canonical row when media confirmation is retried", async () => {
    const bucket = getConfiguredStorageBucket();
    const canonical = {
      id: "media-1",
      incidentId: "inc-1",
      mediaType: "Image",
      bucket,
      objectKey: "evidence/inc-1/44444444-4444-4444-8444-444444444444.jpg",
      contentType: "image/jpeg",
      fileHash: "sha256:duplicate",
      sizeBytes: BigInt(4096),
      latitude: "6.524379",
      longitude: "3.379206",
      uploadedAt: new Date("2026-08-05T10:00:10.000Z"),
    };
    const incidentMedia = {
      findUnique: jest.fn().mockResolvedValue(canonical),
      create: jest.fn(),
    };
    const { service } = buildIncidentsService({
      prisma: {
        incident: {
          findFirst: jest.fn().mockResolvedValue(activeIncident),
        },
        incidentMedia,
      },
    });

    const result = await service.confirmMedia(
      "inc-1",
      {
        mediaType: "Image",
        bucket,
        objectKey: "evidence/inc-1/55555555-5555-4555-8555-555555555555.jpg",
        contentType: "image/jpeg",
        fileHash: canonical.fileHash,
      },
      reporter,
    );

    expect(result.id).toBe("media-1");
    expect(result.sizeBytes).toBe(4096);
    expect(result.latitude).toBe(6.524379);
    expect(result.longitude).toBe(3.379206);
    expect(JSON.stringify(result)).toContain('"sizeBytes":4096');
    expect(incidentMedia.create).not.toHaveBeenCalled();
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
