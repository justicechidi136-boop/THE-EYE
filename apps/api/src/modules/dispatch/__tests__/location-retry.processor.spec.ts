import { ForbiddenException } from "@nestjs/common";
import { IncidentStatus } from "@the-eye/shared";
import { LocationRetryProcessor } from "../location-retry.processor";

function buildProcessor(overrides: Partial<Record<string, any>> = {}) {
  const locationTracking = {
    persistIncidentLocation: jest.fn().mockResolvedValue({
      incidentId: "inc-1",
      latitude: 6.5,
      longitude: 3.3,
      sequenceNumber: 1,
    }),
    ...(overrides.locationTracking ?? {}),
  };
  return {
    processor: new LocationRetryProcessor(locationTracking as never),
    locationTracking,
  };
}

describe("LocationRetryProcessor", () => {
  it("calls persistIncidentLocation with reporter actor and idempotency key", async () => {
    const { processor, locationTracking } = buildProcessor();
    const job = {
      id: "incident-location:inc-1:1",
      data: {
        incidentId: "inc-1",
        dto: { latitude: 6.5, longitude: 3.3, sequenceNumber: 1 },
        reporterId: "user-1",
        idempotencyKey: "inc-1:1",
        requestId: "req-1",
      },
    };

    const result = await processor.process(job as never);
    expect(result).toEqual({ status: "ok" });
    expect(locationTracking.persistIncidentLocation).toHaveBeenCalledWith(
      "inc-1",
      job.data.dto,
      { sub: "user-1", typ: "user" },
      { idempotencyKey: "inc-1:1", requestId: "req-1" },
    );
  });

  it("rethrows persistence failures for BullMQ retry handling", async () => {
    const { processor, locationTracking } = buildProcessor({
      locationTracking: {
        persistIncidentLocation: jest.fn().mockRejectedValue(new Error("createOne mismatch")),
      },
    });
    const job = {
      id: "incident-location:inc-1:1",
      data: {
        incidentId: "inc-1",
        dto: { latitude: 6.5, longitude: 3.3, sequenceNumber: 1 },
        reporterId: "user-1",
        idempotencyKey: "inc-1:1",
      },
    };

    await expect(processor.process(job as never)).rejects.toThrow("createOne mismatch");
  });

  it("does not include coordinates in thrown errors", async () => {
    const { processor } = buildProcessor({
      locationTracking: {
        persistIncidentLocation: jest.fn().mockRejectedValue(new ForbiddenException("Location access denied")),
      },
    });
    const job = {
      id: "incident-location:inc-1:1",
      data: {
        incidentId: "inc-1",
        dto: { latitude: 6.5, longitude: 3.3, sequenceNumber: 1, source: "mobile_gps" },
        reporterId: "user-1",
        idempotencyKey: "inc-1:1",
      },
    };

    try {
      await processor.process(job as never);
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(String(error)).not.toContain("6.5");
      expect(String(error)).not.toContain("3.3");
    }
  });

  it("job payload shape excludes auth tokens", () => {
    const payload = {
      incidentId: "inc-1",
      dto: { latitude: 6.5, longitude: 3.3, sequenceNumber: 1 },
      reporterId: "user-1",
      idempotencyKey: "inc-1:1",
      requestId: "req-1",
    };
    expect(JSON.stringify(payload)).not.toMatch(/jwt|refresh|livekit|token/i);
  });
});

describe("LocationRetryProcessor idempotent persistence integration", () => {
  it("returns existing persisted row for duplicate sequence via persistIncidentLocation", async () => {
    const { processor, locationTracking } = buildProcessor({
      locationTracking: {
        persistIncidentLocation: jest.fn().mockResolvedValue({
          incidentId: "inc-1",
          latitude: 6.5,
          longitude: 3.3,
          sequenceNumber: 1,
        }),
      },
    });
    const job = {
      id: "incident-location:inc-1:1",
      data: {
        incidentId: "inc-1",
        dto: { latitude: 6.5, longitude: 3.3, sequenceNumber: 1 },
        reporterId: "user-1",
        idempotencyKey: "inc-1:1",
      },
    };

    await processor.process(job as never);
    await processor.process(job as never);
    expect(locationTracking.persistIncidentLocation).toHaveBeenCalledTimes(2);
  });

  it("rejects closed incident updates through shared persistence", async () => {
    const { processor, locationTracking } = buildProcessor({
      locationTracking: {
        persistIncidentLocation: jest
          .fn()
          .mockRejectedValue(new Error("Location streaming is not allowed for closed incidents")),
      },
    });
    const job = {
      id: "incident-location:inc-closed:1",
      data: {
        incidentId: "inc-closed",
        dto: { latitude: 6.5, longitude: 3.3, sequenceNumber: 1 },
        reporterId: "user-1",
        idempotencyKey: "inc-closed:1",
      },
    };

    await expect(processor.process(job as never)).rejects.toThrow("closed incidents");
    expect(locationTracking.persistIncidentLocation).toHaveBeenCalled();
  });
});
