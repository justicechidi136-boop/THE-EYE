import {
  buildIncidentLocationIdempotencyKey,
  buildIncidentLocationRetryJobId,
  resolveLocationRetryIdempotencyKey,
} from "../location-retry-idempotency";

describe("location retry idempotency keys", () => {
  it("derives idempotency key from incident and sequence", () => {
    expect(buildIncidentLocationIdempotencyKey("inc-1", 3)).toBe("inc-1:3");
  });

  it("builds deterministic business job id without attempt counter", () => {
    expect(buildIncidentLocationRetryJobId("inc-1:3")).toBe("incident-location-inc-1-3");
  });

  it("prefers explicit idempotency key in payload", () => {
    expect(
      resolveLocationRetryIdempotencyKey({
        incidentId: "inc-1",
        dto: { latitude: 1, longitude: 2, sequenceNumber: 9 },
        idempotencyKey: "custom-key",
      }),
    ).toBe("custom-key");
  });
});
