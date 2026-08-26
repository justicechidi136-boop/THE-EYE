import { classifyDangerAreaRisk, dangerRecipientEligibility, resolveDangerRadius } from "../danger-trigger.policy";
import { validateStartDangerTriggerDto } from "../dto/danger-trigger.dto";

const metersNorth = (meters: number) => meters / 111_320;

describe("danger trigger geographic policy", () => {
  it("uses bounded thresholds for historical area risk", () => {
    expect(classifyDangerAreaRisk(0)).toBe("GREEN_SAFE");
    expect(classifyDangerAreaRisk(1)).toBe("GREEN_SAFE");
    expect(classifyDangerAreaRisk(2)).toBe("MEDIUM_RISK");
    expect(classifyDangerAreaRisk(4)).toBe("MEDIUM_RISK");
    expect(classifyDangerAreaRisk(5)).toBe("HIGH_RISK");
  });

  it("includes recipients from 100 metres through the exact four kilometre boundary", () => {
    for (const distance of [100, 1_000, 3_900, 4_000]) {
      const result = dangerRecipientEligibility({
        dangerLatitude: 6.5244,
        dangerLongitude: 3.3792,
        recipientLatitude: 6.5244 + metersNorth(distance),
        recipientLongitude: 3.3792,
        recipientLocationAt: new Date(),
        radiusMeters: 4_000,
      });
      expect(result.eligible).toBe(true);
    }
  });

  it("excludes recipients beyond four kilometres", () => {
    const result = dangerRecipientEligibility({
      dangerLatitude: 6.5244,
      dangerLongitude: 3.3792,
      recipientLatitude: 6.5244 + metersNorth(4_050),
      recipientLongitude: 3.3792,
      recipientLocationAt: new Date(),
      radiusMeters: 4_000,
    });
    expect(result.eligible).toBe(false);
    expect(result.distanceMeters).toBeGreaterThan(4_000);
  });

  it("excludes stale recipient locations", () => {
    const result = dangerRecipientEligibility({
      dangerLatitude: 6.5244,
      dangerLongitude: 3.3792,
      recipientLatitude: 6.525,
      recipientLongitude: 3.3792,
      recipientLocationAt: new Date(Date.now() - 31 * 60_000),
      radiusMeters: 4_000,
    });
    expect(result.eligible).toBe(false);
    expect(result.locationFresh).toBe(false);
  });

  it("never permits configuration above the owner-approved maximum", () => {
    expect(resolveDangerRadius("12000")).toBe(4_000);
    expect(resolveDangerRadius("2500")).toBe(2_500);
  });

  it("rejects a stale trigger location", () => {
    expect(() =>
      validateStartDangerTriggerDto({
        clientTriggerId: "trigger-1",
        latitude: 6.5244,
        longitude: 3.3792,
        locationSource: "freshGps",
        locationCapturedAt: new Date(Date.now() - 31 * 60_000).toISOString(),
      }),
    ).toThrow();
  });
});
