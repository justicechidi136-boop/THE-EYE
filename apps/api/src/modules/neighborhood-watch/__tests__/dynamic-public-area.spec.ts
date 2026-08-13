import {
  buildDynamicAreaFromJurisdiction,
  buildDynamicAreaGeohashFallback,
  encodeGeohash,
  normalizeGeoToken,
} from "../dynamic-public-area";

describe("dynamic-public-area", () => {
  it("normalizes geography tokens for stable keys", () => {
    expect(normalizeGeoToken("Obio-Akpor")).toBe("OBIO_AKPOR");
    expect(normalizeGeoToken("Port Harcourt")).toBe("PORT_HARCOURT");
  });

  it("builds deterministic area keys from jurisdiction", () => {
    const area = buildDynamicAreaFromJurisdiction({
      country: "Nigeria",
      state: "Rivers",
      lga: "Obio-Akpor",
      resolutionSource: "jurisdiction_polygon",
    });
    expect(area.areaKey).toBe("da:NIGERIA:RIVERS:OBIO_AKPOR");
    expect(area.country).toBe("Nigeria");
    expect(area.lga).toBe("Obio-Akpor");
  });

  it("does not use exact lat/lng as the public area key", () => {
    const a = buildDynamicAreaGeohashFallback(4.84721, 7.00741);
    const b = buildDynamicAreaGeohashFallback(4.84729, 7.00749);
    expect(a.areaKey).toMatch(/^da:gh:/);
    expect(a.areaKey).toBe(b.areaKey);
    expect(a.areaKey.includes("4.847")).toBe(false);
  });

  it("encodes stable geohash cells", () => {
    expect(encodeGeohash(4.8472, 7.0074, 5)).toHaveLength(5);
  });
});
