import { evaluateAlertEligibility, isPublicAlertIncidentType } from "../danger-zone-eligibility";
import { IncidentPriority, IncidentStatus, IncidentType } from "@the-eye/shared";

describe("danger-zone-eligibility", () => {
  it("allows verified kidnapping incidents for public alerts", () => {
    const result = evaluateAlertEligibility({
      incidentType: IncidentType.Kidnapping,
      priority: IncidentPriority.P1LifeThreatening,
      status: IncidentStatus.Verified,
      confidenceScore: 90,
    });
    expect(result.eligible).toBe(true);
    expect(result.autoActivate).toBe(true);
    expect(result.suggestedSeverity).toBe("P1Immediate");
  });

  it("blocks unverified incidents from auto public alerts", () => {
    const result = evaluateAlertEligibility({
      incidentType: IncidentType.Kidnapping,
      priority: IncidentPriority.P1LifeThreatening,
      status: IncidentStatus.Verifying,
      confidenceScore: 40,
    });
    expect(result.eligible).toBe(false);
    expect(result.autoActivate).toBe(false);
  });

  it("does not treat low-risk incident types as public alert candidates", () => {
    expect(isPublicAlertIncidentType(IncidentType.StolenVehicle)).toBe(false);
  });
});
