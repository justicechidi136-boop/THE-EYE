import { EtaService } from "../eta.service";

describe("EtaService", () => {
  const service = new EtaService();
  const originalProvider = process.env.ROAD_ROUTING_PROVIDER_URL;

  it("returns haversine distance when postgis is unavailable", async () => {
    const result = await service.distanceBetween(6.5244, 3.3792, 6.6018, 3.3515, async () => null);
    expect(result.distanceSource).toBe("haversine");
    expect(result.distanceMeters).toBeGreaterThan(0);
    expect(result.etaSource).toBe("unavailable");
    expect(result.etaSeconds).toBe(null);
    expect(result.etaLabel).toContain("Straight-line");
  });

  it("prefers postgis distance when query succeeds", async () => {
    const result = await service.distanceBetween(6.5244, 3.3792, 6.6018, 3.3515, async () => 8420);
    expect(result.distanceSource).toBe("postgis");
    expect(result.distanceMeters).toBe(8420);
  });

  it("does not label straight-line distance as road ETA without provider integration", async () => {
    delete process.env.ROAD_ROUTING_PROVIDER_URL;
    const result = await service.distanceBetween(6.5244, 3.3792, 6.6018, 3.3515);
    expect(result.etaSource).toBe("unavailable");
    expect(result.navigationUrl).toContain("google.com/maps");
  });

  it("marks road provider configured but ETA unavailable when env is set", async () => {
    process.env.ROAD_ROUTING_PROVIDER_URL = "https://routing.example.test";
    const result = await service.distanceBetween(6.5244, 3.3792, 6.6018, 3.3515);
    expect(result.etaSource).toBe("road-provider");
    expect(result.etaSeconds).toBe(null);
    if (originalProvider === undefined) delete process.env.ROAD_ROUTING_PROVIDER_URL;
    else process.env.ROAD_ROUTING_PROVIDER_URL = originalProvider;
  });
});
