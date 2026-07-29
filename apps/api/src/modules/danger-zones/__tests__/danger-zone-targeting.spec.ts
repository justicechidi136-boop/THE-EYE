import { DangerZoneTargetingService } from "../danger-zone-targeting.service";

describe("DangerZoneTargetingService", () => {
  const service = new DangerZoneTargetingService({} as any, {} as any, {} as any);

  it("marks users inside the inner radius as InsideDangerZone", () => {
    expect(service.resolveAlertState(150, 200, 1000, 2000, null)).toBe("InsideDangerZone");
  });

  it("marks users between warning and outer radius as Approaching or Awareness", () => {
    expect(service.resolveAlertState(800, 200, 1000, 2000, 900)).toBe("Approaching");
    expect(service.resolveAlertState(1500, 200, 1000, 2000, null)).toBe("Awareness");
  });

  it("does not escalate when user is outside awareness radius", () => {
    expect(service.resolveAlertState(5000, 200, 1000, 2000, null)).toBe("Clear");
  });
});
