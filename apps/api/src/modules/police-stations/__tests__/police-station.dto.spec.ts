import { BadRequestException } from "@nestjs/common";
import { parseNearestQuery, parseNearbyPoliceQuery, validatePoliceStationDto } from "../dto/police-station.dto";

describe("police station locator dto", () => {
  it("parses a nearest station query with safe limits", () => {
    expect(parseNearestQuery({ latitude: "6.6018", longitude: "3.3515", limit: "200", radiusMeters: "10" })).toEqual({
      latitude: 6.6018,
      longitude: 3.3515,
      limit: 50,
      radiusMeters: 100,
      agencyType: undefined,
    });
  });

  it("caps nearby radius to configured maximum", () => {
    process.env.GOOGLE_PLACES_MAX_RADIUS_METERS = "50000";
    expect(parseNearbyPoliceQuery({ latitude: "6.6018", longitude: "3.3515", radius: "999999" }).radiusMeters).toBe(50000);
  });

  it("rejects invalid coordinates", () => {
    expect(() => parseNearestQuery({ latitude: "200", longitude: "3.3515" })).toThrow(BadRequestException);
    expect(() => validatePoliceStationDto({
      name: "A",
      address: "Ikeja",
      agencyType: "police",
      latitude: 6,
      longitude: 200,
      source: "Admin intake",
      sourceReference: "ref-1",
    })).toThrow(BadRequestException);
  });
});
