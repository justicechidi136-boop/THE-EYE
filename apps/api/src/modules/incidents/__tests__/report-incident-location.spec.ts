import { IncidentType } from "@the-eye/shared";
import { BadRequestException } from "@nestjs/common";
import { validateReportIncidentDto } from "../dto/report-incident.dto";

describe("validateReportIncidentDto location metadata", () => {
  it("accepts emergency report with pending location and omitted coordinates", () => {
    expect(() =>
      validateReportIncidentDto({
        type: IncidentType.Emergency,
        description: "Live emergency video started while location is pending.",
        locationStatus: "pending",
        locationSource: "unavailable",
      }),
    ).not.toThrow();
  });

  it("rejects 0,0 placeholder even when pending", () => {
    expect(() =>
      validateReportIncidentDto({
        type: IncidentType.Emergency,
        description: "Live emergency video started while location is pending.",
        latitude: 0,
        longitude: 0,
        locationStatus: "pending",
        locationSource: "unavailable",
      }),
    ).toThrow(BadRequestException);
  });

  it("accepts cached emergency coordinates with metadata", () => {
    expect(() =>
      validateReportIncidentDto({
        type: IncidentType.Emergency,
        description: "Emergency submitted with cached device location.",
        latitude: 6.6012,
        longitude: 3.3515,
        locationStatus: "cached",
        locationSource: "cachedDevice",
        isCached: true,
        ageSeconds: 42,
        quality: "acceptable",
        accuracyMeters: 80,
      }),
    ).not.toThrow();
  });
});
