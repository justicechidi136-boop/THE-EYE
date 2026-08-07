import {
  citizenIncidentStatusLabel,
  citizenTimelineMessage,
  formatCitizenEmailTimestamp,
} from "../citizen-presentation";
import { buildIncidentPublicReference } from "../public-reference";

describe("public reference", () => {
  it("builds EYE references from incident id and submitted date", () => {
    expect(
      buildIncidentPublicReference({
        incidentId: "11111111-2222-3333-4444-555555555555",
        submittedAt: new Date("2026-08-07T10:13:00.000Z"),
      }),
    ).toBe("EYE-260807-5555");
  });
});

describe("citizen presentation", () => {
  it("maps verifying status", () => {
    expect(citizenIncidentStatusLabel("Verifying")).toBe("Verification in progress");
  });

  it("maps timeline event types", () => {
    expect(
      citizenTimelineMessage({
        eventType: "AutomaticTriageCompleted",
        message: "Automatic triage completed",
      }),
    ).toBe("Your report has been routed to the appropriate response team");
  });

  it("formats email timestamps without ISO strings", () => {
    const formatted = formatCitizenEmailTimestamp(
      new Date("2026-08-07T10:13:00.000Z"),
      new Date("2026-08-07T12:00:00.000Z"),
    );
    expect(formatted).toContain("Today");
    expect(formatted).not.toContain("T10:13:00");
  });
});
