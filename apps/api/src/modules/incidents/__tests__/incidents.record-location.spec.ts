import { BadRequestException, HttpException, ServiceUnavailableException } from "@nestjs/common";
import { IncidentStatus } from "@the-eye/shared";
import { IncidentsService } from "../incidents.service";

function buildIncidentsService(overrides: Record<string, unknown> = {}) {
  const locationTracking = {
    persistIncidentLocation: jest.fn(),
    recordCitizenLocation: jest.fn(),
    ...(overrides.locationTracking as object),
  };
  const locationRetry = {
    scheduleRetry: jest.fn().mockResolvedValue({ accepted: true, retryId: "incident-location-inc-1-1", duplicate: false }),
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
  it("returns persisted payload on immediate success", async () => {
    const { service, locationTracking } = buildIncidentsService();
    locationTracking.persistIncidentLocation.mockResolvedValue({
      incidentId: "inc-1",
      latitude: 6.5,
      longitude: 3.3,
      sequenceNumber: 1,
    });

    const result = await service.recordLocation(
      "inc-1",
      { latitude: 6.5, longitude: 3.3, sequenceNumber: 1 },
      { sub: "user-1", typ: "user" },
    );

    expect(result).toEqual(
      expect.objectContaining({
        persisted: true,
        retryQueued: false,
        data: expect.objectContaining({ sequenceNumber: 1 }),
      }),
    );
  });

  it("returns 202 when retry queue accepts the update", async () => {
    const { service, locationTracking, locationRetry } = buildIncidentsService();
    locationTracking.persistIncidentLocation.mockRejectedValue(
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
    ).rejects.toMatchObject({
      status: 202,
      response: expect.objectContaining({
        retryQueued: true,
        retryId: "incident-location-inc-1-1",
        persisted: false,
      }),
    });

    expect(locationRetry.scheduleRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        incidentId: "inc-1",
        reporterId: "user-1",
        idempotencyKey: "inc-1:1",
      }),
    );
  });

  it("returns factual 503 when enqueue is not accepted", async () => {
    const { service, locationTracking } = buildIncidentsService({
      locationRetry: {
        scheduleRetry: jest.fn().mockResolvedValue({ accepted: false, reason: "queue_unavailable" }),
      },
    });
    locationTracking.persistIncidentLocation.mockRejectedValue(
      new Error(
        "Invalid `prisma.incidentLocationUpdate.create()` invocation: Operation 'createOne' for model 'IncidentLocationUpdate' does not match any query.",
      ),
    );

    try {
      await service.recordLocation(
        "inc-1",
        { latitude: 6.5, longitude: 3.3, sequenceNumber: 1 },
        { sub: "user-1", typ: "user" },
      );
      throw new Error("expected ServiceUnavailableException");
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getResponse()).toEqual(
        expect.objectContaining({
          retryQueued: false,
          persisted: false,
          errorCode: "LOCATION-RETRY-001",
        }),
      );
    }
  });

  it("rethrows non-persistence validation failures", async () => {
    const { service, locationTracking, locationRetry } = buildIncidentsService();
    locationTracking.persistIncidentLocation.mockRejectedValue(new BadRequestException("bad coords"));

    await expect(
      service.recordLocation("inc-1", { latitude: 6.5, longitude: 3.3 }, { sub: "user-1", typ: "user" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(locationRetry.scheduleRetry).not.toHaveBeenCalled();
  });
});
