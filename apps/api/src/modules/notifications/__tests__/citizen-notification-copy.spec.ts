import {
  assertValidMissingPersonAge,
  buildMissingPersonBroadcastPreview,
  reportSubmittedNotificationCopy,
  resolveCitizenIncidentTypeLabel,
  resolveCancellationReason,
  verifyActiveIncidentNotificationCopy,
  verifyActiveIncidentNotificationCopyForType,
} from "../citizen-notification-copy";

describe("UX-016 / missing-person notification copy", () => {
  it("accepts exact age and approved ranges", () => {
    expect(assertValidMissingPersonAge("15")).toBe("15");
    expect(assertValidMissingPersonAge("10-15")).toBe("10–15");
  });

  it("rejects missing age values", () => {
    try {
      assertValidMissingPersonAge("");
      throw new Error("expected empty age to fail");
    } catch (error) {
      expect(String((error as Error).message)).toContain("required");
    }
    try {
      assertValidMissingPersonAge("teen");
      throw new Error("expected free-text age to fail");
    } catch (error) {
      expect(String((error as Error).message)).toContain("exact age");
    }
  });

  it("builds exact and range broadcast previews", () => {
    const exact = buildMissingPersonBroadcastPreview({
      fullName: "Pele Vic",
      ageOrApproximateAge: "15",
      lastSeenAt: "2026-08-04T15:10:00.000Z",
    });
    expect(exact).toContain("15-year-old Pele Vic");
    const range = buildMissingPersonBroadcastPreview({
      fullName: "Pele Vic",
      ageOrApproximateAge: "10-15",
      lastSeenAt: "2026-08-04T15:10:00.000Z",
    });
    expect(range).toContain("approximately 10–15 years old");
  });

  it("builds report submitted and verify copies without private payload", () => {
    const submitted = reportSubmittedNotificationCopy("EYE-260810-AE7C");
    expect(submitted.title).toContain("received");
    expect(submitted.body).toContain("EYE-260810-AE7C");
    expect(JSON.stringify(submitted.metadata)).not.toContain("latitude");

    const verify = verifyActiveIncidentNotificationCopy();
    expect(verify.title).toBe("Can you confirm this emergency?");
    expect(verify.metadata.route).toBe("COMMUNITY_VERIFICATION");
    expect(verify.metadata.incidentCategory).toBe("Emergency");
  });

  it("builds category-aware verification copy", () => {
    const samples: Array<[string, string]> = [
      ["Accident", "Can you confirm this accident?"],
      ["Fire", "Can you confirm this fire?"],
      ["SuspiciousActivity", "Can you confirm this suspicious activity?"],
      ["Crime", "Can you confirm this crime?"],
      ["EmergencyCase", "Can you confirm this emergency?"],
    ];
    for (const finalSample of samples) {
      const [incidentType, expectedTitle] = finalSample;
      const copy = verifyActiveIncidentNotificationCopyForType(incidentType);
      expect(copy.title).toBe(expectedTitle);
      expect(copy.body).toContain("near your location");
      expect(copy.metadata.incidentCategory.length).toBeGreaterThan(0);
    }
  });

  it("normalizes incident type labels for citizen copy", () => {
    expect(resolveCitizenIncidentTypeLabel("EmergencyCase")).toBe("Emergency");
    expect(resolveCitizenIncidentTypeLabel("LiveEmergencyVideo")).toBe(
      "Live Emergency Video",
    );
  });
});

describe("UX-015 cancellation reason codes", () => {
  it("maps structured codes and requires text for OTHER", () => {
    expect(resolveCancellationReason({ reasonCode: "REPORTED_BY_MISTAKE" }).reason).toBe(
      "Reported by mistake",
    );
    try {
      resolveCancellationReason({ reasonCode: "OTHER" });
      throw new Error("expected OTHER without text to fail");
    } catch (error) {
      expect(String((error as Error).message)).toContain("enter a reason");
    }
    expect(
      resolveCancellationReason({ reasonCode: "OTHER", reasonText: "Already safe" }).reason,
    ).toBe("Other: Already safe");
  });
});
