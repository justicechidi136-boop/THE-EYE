import { BadRequestException } from "@nestjs/common";
import { IncidentPriority, IncidentStatus, IncidentType } from "@the-eye/shared";
import { IncidentsService } from "../incidents.service";
import { JurisdictionResolutionStatus } from "../jurisdiction-resolution.service";
import { validateRegisterVolunteer } from "../../neighborhood-watch/dto/neighborhood-watch.dto";

function buildIncidentsService(overrides: Record<string, unknown> = {}) {
  const incidentCreate = jest.fn().mockResolvedValue({
    id: "incident-1",
    status: IncidentStatus.Submitted,
    priority: IncidentPriority.P2ActiveCrimeAccident,
    submittedAt: new Date("2026-07-26T16:00:00.000Z"),
  });
  const incidentTimelineCreate = jest.fn().mockResolvedValue({ id: "timeline-1" });
  const incidentFindUnique = jest.fn().mockResolvedValue(null);
  const prisma = {
    incident: {
      create: incidentCreate,
      findUnique: incidentFindUnique,
    },
    incidentTimeline: {
      create: incidentTimelineCreate,
    },
    ...overrides,
  } as any;

  const audit = { record: jest.fn().mockResolvedValue({ id: "audit-1" }) } as any;
  const metrics = { recordIncidentSubmission: jest.fn() } as any;
  const verification = { verifyIncident: jest.fn().mockResolvedValue(undefined) } as any;
  const notifications = { enqueue: jest.fn().mockResolvedValue({ jobId: "job-1" }) } as any;
  const dispatchService = { runTriageForIncident: jest.fn().mockResolvedValue(undefined) } as any;
  const emergencyClassification = {} as any;
  const locationTracking = {} as any;
  const locationRetry = { scheduleRetry: jest.fn() } as any;
  const incidentTimeline = { buildTimeline: jest.fn() } as any;
  const etaService = {} as any;
  const jurisdictionResolution = {
    resolve: jest.fn().mockResolvedValue({
      id: "jurisdiction-1",
      country: "Nigeria",
      state: "Lagos",
      lga: "Ikeja",
      resolutionStatus: JurisdictionResolutionStatus.ResolvedByCoordinates,
      resolutionSource: "postgis_polygon",
    }),
  } as any;

  const service = new IncidentsService(
    prisma,
    audit,
    metrics,
    verification,
    notifications,
    dispatchService,
    emergencyClassification,
    locationTracking,
    locationRetry,
    incidentTimeline,
    etaService,
    jurisdictionResolution,
  );

  return {
    service,
    prisma,
    audit,
    metrics,
    notifications,
    incidentCreate,
    incidentTimelineCreate,
    jurisdictionResolution,
  };
}

describe("IncidentsService report isolation", () => {
  const baseDto = {
    type: IncidentType.Crime,
    description: "Witnessed suspicious activity near the junction.",
    latitude: 6.6018,
    longitude: 3.3515,
    anonymous: true,
  };

  it("returns incident id when timeline write fails", async () => {
    const { service, incidentCreate, incidentTimelineCreate } = buildIncidentsService();
    incidentTimelineCreate.mockRejectedValueOnce(new Error("timeline table missing"));

    const response = await service.report(baseDto);

    expect(incidentCreate).toHaveBeenCalledTimes(1);
    expect(response.id).toBe("incident-1");
    expect(
      response.nonCriticalWarnings?.some((warning: string) =>
        warning.includes("incident.timeline.submitted"),
      ),
    ).toBe(true);
  });

  it("returns incident id when audit write fails", async () => {
    const { service, audit } = buildIncidentsService();
    audit.record.mockRejectedValueOnce(new Error("audit chain unavailable"));

    const response = await service.report(baseDto, undefined, true);

    expect(response.id).toBe("incident-1");
    expect(
      response.nonCriticalWarnings?.some((warning: string) =>
        warning.includes("incident.audit.created"),
      ),
    ).toBe(true);
  });

  it("returns duplicate incident without creating a new row", async () => {
    const existing = {
      id: "incident-existing",
      status: IncidentStatus.Submitted,
      priority: IncidentPriority.P2ActiveCrimeAccident,
      submittedAt: new Date("2026-07-26T15:00:00.000Z"),
    };
    const { service, incidentCreate, prisma } = buildIncidentsService();
    prisma.incident.findUnique.mockResolvedValueOnce(existing);

    const response = await service.report({
      ...baseDto,
      clientSubmissionId: "mobile-draft-123",
    });

    expect(incidentCreate).not.toHaveBeenCalled();
    expect(response.duplicate).toBe(true);
    expect(response.id).toBe("incident-existing");
  });

  it("uses jurisdiction fallback metadata without aborting emergency intake", async () => {
    const { service, jurisdictionResolution } = buildIncidentsService();
    jurisdictionResolution.resolve.mockResolvedValueOnce({
      id: "jurisdiction-unassigned",
      country: "Nigeria",
      state: "All",
      lga: "All",
      resolutionStatus: JurisdictionResolutionStatus.LocationUnavailable,
      resolutionSource: "default_hierarchy",
    });

    const response = await service.reportEmergency(baseDto);

    expect(response.id).toBe("incident-1");
    expect(jurisdictionResolution.resolve).toHaveBeenCalled();
  });
});

describe("validateRegisterVolunteer", () => {
  it("rejects empty volunteer categories", () => {
    expect(() => validateRegisterVolunteer({ types: [] })).toThrow(BadRequestException);
  });

  it("rejects unsupported volunteer enum values", () => {
    expect(() =>
      validateRegisterVolunteer({ types: ["Paramedic" as never] }),
    ).toThrow(BadRequestException);
  });

  it("accepts canonical volunteer enum payload", () => {
    expect(() =>
      validateRegisterVolunteer({ types: ["Doctor", "FirstAid", "SecurityVolunteer"] }),
    ).not.toThrow();
  });
});
