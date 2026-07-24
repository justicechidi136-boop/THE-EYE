import { BadRequestException } from "@nestjs/common";

export const IncidentLocationStatus = {
  Available: "available",
  Cached: "cached",
  Pending: "pending",
  Denied: "denied",
  ServiceDisabled: "serviceDisabled",
  Unavailable: "unavailable",
} as const;

export type IncidentLocationStatusValue =
  (typeof IncidentLocationStatus)[keyof typeof IncidentLocationStatus];

export const ALLOWED_LOCATION_SOURCES = new Set([
  "freshGps",
  "networkLocation",
  "cachedDevice",
  "mobileGps",
  "cachedMobile",
  "phoneRelay",
  "watchGps",
  "manual",
  "unavailable",
]);

export const ALLOWED_LOCATION_QUALITIES = new Set([
  "precise",
  "acceptable",
  "lowAccuracy",
  "stale",
  "invalid",
  "unavailable",
]);

const PENDING_STATUSES = new Set<string>([
  IncidentLocationStatus.Pending,
  IncidentLocationStatus.Denied,
  IncidentLocationStatus.ServiceDisabled,
  IncidentLocationStatus.Unavailable,
]);

const COORDINATE_REQUIRED_STATUSES = new Set<string>([
  IncidentLocationStatus.Available,
  IncidentLocationStatus.Cached,
]);

export function isMissingLocationPlaceholder(
  latitude?: number | null,
  longitude?: number | null,
): boolean {
  if (latitude == null || longitude == null) return true;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return true;
  if (latitude === 0 && longitude === 0) return true;
  if (Math.abs(latitude) < 0.0001 && Math.abs(longitude) < 0.0001) return true;
  return false;
}

export function isPendingLocationStatus(status?: string | null): boolean {
  return status != null && PENDING_STATUSES.has(status);
}

export function incidentHasSubmissionCoordinates(input: {
  latitude?: number | null;
  longitude?: number | null;
  locationStatus?: string | null;
}): boolean {
  if (isPendingLocationStatus(input.locationStatus)) return false;
  if (input.locationStatus && COORDINATE_REQUIRED_STATUSES.has(input.locationStatus)) {
    return !isMissingLocationPlaceholder(input.latitude, input.longitude);
  }
  return !isMissingLocationPlaceholder(input.latitude, input.longitude);
}

export function assertNoZeroCoordinatePlaceholder(
  latitude?: number | null,
  longitude?: number | null,
): void {
  if (latitude === 0 && longitude === 0) {
    throw new BadRequestException(
      "latitude/longitude 0,0 is not allowed as a missing-location placeholder",
    );
  }
  if (
    latitude != null &&
    longitude != null &&
    Math.abs(latitude) < 0.0001 &&
    Math.abs(longitude) < 0.0001
  ) {
    throw new BadRequestException(
      "latitude/longitude near 0,0 is not allowed as a missing-location placeholder",
    );
  }
}

export function assertLocationMetadataConsistency(input: {
  latitude?: number | null;
  longitude?: number | null;
  locationStatus?: string | null;
  locationSource?: string | null;
  accuracyMeters?: number | null;
}): void {
  assertNoZeroCoordinatePlaceholder(input.latitude, input.longitude);

  if (input.locationSource && !ALLOWED_LOCATION_SOURCES.has(input.locationSource)) {
    throw new BadRequestException("Unsupported locationSource");
  }

  if (isPendingLocationStatus(input.locationStatus)) {
    if (input.latitude != null || input.longitude != null) {
      throw new BadRequestException(
        "latitude and longitude must be omitted when locationStatus indicates missing location",
      );
    }
    if (input.accuracyMeters != null) {
      throw new BadRequestException("accuracyMeters must be omitted when location is pending");
    }
    return;
  }

  if (
    input.locationStatus &&
    COORDINATE_REQUIRED_STATUSES.has(input.locationStatus) &&
    isMissingLocationPlaceholder(input.latitude, input.longitude)
  ) {
    throw new BadRequestException(
      `latitude and longitude are required when locationStatus is ${input.locationStatus}`,
    );
  }
}
