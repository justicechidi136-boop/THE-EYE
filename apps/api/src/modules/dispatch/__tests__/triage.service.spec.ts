import { IncidentPriority, IncidentType } from "@the-eye/shared";
import { deadlineFromPriority, TriageService, urgencyFromPriority } from "../triage.service";

describe("TriageService", () => {
  const service = new TriageService();

  it("raises priority for weapon and medical indicators", () => {
    const result = service.evaluate({
      incidentId: "inc-1",
      incidentType: IncidentType.Crime,
      latitude: 6.6,
      longitude: 3.35,
      indicators: { weaponIndicators: true, medicalIndicators: true },
    });
    expect(result.priority).toBe(IncidentPriority.P1LifeThreatening);
    expect(result.responseUrgency).toBe("immediate");
    expect(result.rationale.some((line) => line.includes("Weapon"))).toBe(true);
  });

  it("supports dispatcher override with audit rationale", () => {
    const result = service.evaluate({
      incidentId: "inc-2",
      incidentType: IncidentType.Medical,
      latitude: 6.6,
      longitude: 3.35,
      dispatcherOverride: {
        priority: IncidentPriority.P2ActiveCrimeAccident,
        overrideReason: "Dispatcher confirmed non-life-threatening scene",
      },
    });
    expect(result.overridden).toBe(true);
    expect(result.priority).toBe(IncidentPriority.P2ActiveCrimeAccident);
    expect(result.overrideReason).toContain("Dispatcher confirmed");
  });

  it("does not reduce access for trusted reporters", () => {
    const result = service.evaluate({
      incidentId: "inc-3",
      incidentType: IncidentType.SuspiciousActivity,
      latitude: 6.6,
      longitude: 3.35,
      isTrustedReporter: true,
    });
    expect(result.rationale.some((line) => line.includes("without reducing access"))).toBe(true);
  });
});

describe("triage helpers", () => {
  it("maps P1 to immediate urgency", () => {
    expect(urgencyFromPriority(IncidentPriority.P1LifeThreatening)).toBe("immediate");
    expect(deadlineFromPriority(IncidentPriority.P1LifeThreatening)).toBe(300);
  });
});
