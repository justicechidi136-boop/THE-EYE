import {
  assertValidBullJobId,
  buildBullJobId,
  InvalidBullJobIdError,
  sanitizeBullJobIdSegment,
} from "../bull-job-id";

describe("bull-job-id", () => {
  it("builds colon-free deterministic ids", () => {
    expect(buildBullJobId("notify", "notification-1", "push", "user-1")).toBe(
      "notify-notification-1-push-user-1",
    );
  });

  it("sanitizes illegal colon segments", () => {
    expect(sanitizeBullJobIdSegment("incident:uuid:1")).toBe("incident_uuid_1");
  });

  it("rejects empty ids", () => {
    expect(() => assertValidBullJobId("")).toThrow(InvalidBullJobIdError);
  });

  it("rejects colon-containing ids", () => {
    expect(() => assertValidBullJobId("notify:bad:id")).toThrow(InvalidBullJobIdError);
  });

  it("rejects integer ids", () => {
    expect(() => assertValidBullJobId("42")).toThrow(InvalidBullJobIdError);
  });

  it("rejects ids that exceed max length", () => {
    expect(() => assertValidBullJobId("a".repeat(513))).toThrow(InvalidBullJobIdError);
  });

  it("accepts unicode segments after sanitization", () => {
    expect(buildBullJobId("notify", "café", "push", "user-1")).toBe("notify-café-push-user-1");
  });

  it("deduplicates logically identical ids", () => {
    const first = buildBullJobId("incident-location", "inc-1", 3);
    const second = buildBullJobId("incident-location", "inc-1", 3);
    expect(first).toBe(second);
    expect(first).toBe("incident-location-inc-1-3");
  });
});
