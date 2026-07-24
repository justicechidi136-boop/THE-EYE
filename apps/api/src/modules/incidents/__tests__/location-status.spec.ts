import { BadRequestException } from "@nestjs/common";
import {
  assertLocationMetadataConsistency,
  assertNoZeroCoordinatePlaceholder,
  incidentHasSubmissionCoordinates,
  isMissingLocationPlaceholder,
  isPendingLocationStatus,
} from "../location-status";

describe("location-status", () => {
  it("rejects 0,0 as missing-location placeholder", () => {
    expect(() => assertNoZeroCoordinatePlaceholder(0, 0)).toThrow(BadRequestException);
  });

  it("treats null coordinates as missing", () => {
    expect(isMissingLocationPlaceholder(null, null)).toBe(true);
  });

  it("requires pending reports to omit coordinates", () => {
    expect(() =>
      assertLocationMetadataConsistency({
        latitude: 0,
        longitude: 0,
        locationStatus: "pending",
        locationSource: "unavailable",
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      assertLocationMetadataConsistency({
        locationStatus: "pending",
        locationSource: "unavailable",
      }),
    ).not.toThrow();
  });

  it("identifies pending statuses", () => {
    expect(isPendingLocationStatus("pending")).toBe(true);
    expect(isPendingLocationStatus("available")).toBe(false);
  });

  it("requires coordinates for available status", () => {
    expect(
      incidentHasSubmissionCoordinates({
        locationStatus: "available",
        latitude: 6.6012,
        longitude: 3.3515,
      }),
    ).toBe(true);
    expect(
      incidentHasSubmissionCoordinates({
        locationStatus: "pending",
      }),
    ).toBe(false);
  });
});
