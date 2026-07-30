import { LocationRetryService } from "../location-retry.service";

describe("LocationRetryService", () => {
  it("returns accepted=false when queue is unavailable", async () => {
    const service = new LocationRetryService(undefined);
    const result = await service.scheduleRetry({
      incidentId: "inc-1",
      dto: { latitude: 6.5, longitude: 3.3, sequenceNumber: 1 },
      reporterId: "user-1",
      idempotencyKey: "inc-1:1",
    });
    expect(result).toEqual({ accepted: false, reason: "queue_unavailable" });
  });

  it("returns accepted=true with deterministic retryId when enqueue succeeds", async () => {
    const queue = {
      getJob: jest.fn().mockResolvedValue(null),
      add: jest.fn().mockResolvedValue({ id: "incident-location-inc-1-1" }),
    };
    const service = new LocationRetryService(queue as never);
    const result = await service.scheduleRetry({
      incidentId: "inc-1",
      dto: { latitude: 6.5, longitude: 3.3, sequenceNumber: 1 },
      reporterId: "user-1",
      idempotencyKey: "inc-1:1",
    });
    expect(result).toEqual({ accepted: true, retryId: "incident-location-inc-1-1", duplicate: false });
    expect(queue.add).toHaveBeenCalledWith(
      "incident.location.retry",
      expect.objectContaining({ incidentId: "inc-1", idempotencyKey: "inc-1:1" }),
      expect.objectContaining({ jobId: "incident-location-inc-1-1", attempts: 5 }),
    );
  });

  it("returns duplicate=true when an active job already exists", async () => {
    const queue = {
      getJob: jest.fn().mockResolvedValue({
        getState: async () => "waiting",
      }),
      add: jest.fn(),
    };
    const service = new LocationRetryService(queue as never);
    const result = await service.scheduleRetry({
      incidentId: "inc-1",
      dto: { latitude: 6.5, longitude: 3.3, sequenceNumber: 1 },
      idempotencyKey: "inc-1:1",
    });
    expect(result).toEqual({ accepted: true, retryId: "incident-location-inc-1-1", duplicate: true });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("returns duplicate=true when job already completed", async () => {
    const queue = {
      getJob: jest.fn().mockResolvedValue({
        getState: async () => "completed",
      }),
      add: jest.fn(),
    };
    const service = new LocationRetryService(queue as never);
    const result = await service.scheduleRetry({
      incidentId: "inc-1",
      dto: { latitude: 6.5, longitude: 3.3, sequenceNumber: 2 },
      idempotencyKey: "inc-1:2",
    });
    expect(result).toEqual({ accepted: true, retryId: "incident-location-inc-1-2", duplicate: true });
    expect(queue.add).not.toHaveBeenCalled();
  });
});
