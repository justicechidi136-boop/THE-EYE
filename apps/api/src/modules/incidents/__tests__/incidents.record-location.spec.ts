import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { IncidentStatus } from "@the-eye/shared";
import { IncidentsService } from "../incidents.service";

function buildIncidentsService(overrides: Record<string, unknown> = {}) {
  const locationTracking = {
    recordCitizenLocation: jest.fn(),
    ...(overrides.locationTracking as object),
  };
  const locationRetry = {
    scheduleRetry: jest.fn().mockResolvedValue(true),
    ...(overrides.locationRetry as object),
  };
  const prisma = {
    incident: {
      findUnique: jest.fn().mockResolvedValue({
        id: "inc-1",
        reporterId: "user-1",
        status: IncidentStatus.Submitted,
      }),
    },
    incidentTimeline: {
      create: jest.fn().mockResolvedValue({ id: "timeline-1" }),
    },
    ...(overrides.prisma as object),
  };

  const service = new IncidentsService(
    prisma as any,
    { record: jest.fn() } as any,
    { recordIncidentSubmission: jest.fn() } as any,
    { verifyIncident: jest.fn() } as any,
    { enqueue: jest.fn() } as any,
    { runTriageForIncident: jest.fn() } as any,
    {} as any,
    locationTracking as any,
    locationRetry as any,
    { buildTimeline: jest.fn() } as any,
    {} as any,
    { resolve: jest.fn() } as any,
  );

  return { service, prisma, locationTracking, locationRetry };
}

describe("IncidentsService.recordLocation persistence isolation", () => {
  it("queues retry and returns ERR-INC-LOCATION-RETRY on createOne mismatch", async () => {
    const { service, locationTracking, locationRetry } = buildIncidentsService();
    locationTracking.recordCitizenLocation.mockRejectedValue(
      new Error(
        "Invalid `prisma.incidentLocationUpdate.create()` invocation: Operation 'createOne' for model 'IncidentLocationUpdate' does not match any query.",
      ),
    );

    await expect(
      service.recordLocation(
        "inc-1",
        { latitude: 6.5, longitude: 3.3, sequenceNumber: 1 },
        { sub: "user-1", typ: "user" },
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(locationRetry.scheduleRetry).toHaveBeenCalledWith(
      expect.objectContaining({ incidentId: "inc-1", reporterId: "user-1" }),
    );
  });

  it("rethrows non-persistence validation failures", async () => {
    const { service, locationTracking, locationRetry } = buildIncidentsService();
    locationTracking.recordCitizenLocation.mockRejectedValue(new BadRequestException("bad coords"));

    await expect(
      service.recordLocation("inc-1", { latitude: 6.5, longitude: 3.3 }, { sub: "user-1", typ: "user" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(locationRetry.scheduleRetry).not.toHaveBeenCalled();
  });
});
