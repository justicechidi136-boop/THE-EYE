import { haversineMeters } from "../verification/verification-signals";

export const OWNER_APPROVED_MAX_DANGER_RADIUS_METERS = 4_000;
export const DANGER_LOCATION_FRESHNESS_MS = 30 * 60_000;
export const DANGER_RECIPIENT_LOCATION_FRESHNESS_MS = 30 * 60_000;

export function resolveDangerRadius(configured?: unknown) {
  const value = Number(configured);
  if (!Number.isFinite(value) || value <= 0) return OWNER_APPROVED_MAX_DANGER_RADIUS_METERS;
  return Math.min(Math.round(value), OWNER_APPROVED_MAX_DANGER_RADIUS_METERS);
}

export function dangerRecipientEligibility(input: {
  dangerLatitude: number;
  dangerLongitude: number;
  recipientLatitude: number;
  recipientLongitude: number;
  recipientLocationAt: Date;
  now?: Date;
  radiusMeters?: number;
}) {
  const now = input.now ?? new Date();
  const radiusMeters = resolveDangerRadius(input.radiusMeters);
  const locationAgeMs = now.getTime() - input.recipientLocationAt.getTime();
  const locationFresh = locationAgeMs >= 0 && locationAgeMs <= DANGER_RECIPIENT_LOCATION_FRESHNESS_MS;
  const distanceMeters = haversineMeters(
    input.dangerLatitude,
    input.dangerLongitude,
    input.recipientLatitude,
    input.recipientLongitude,
  );
  return {
    eligible: locationFresh && distanceMeters <= radiusMeters,
    distanceMeters,
    locationFresh,
    radiusMeters,
  };
}

export function dangerClusterKey(latitude: number, longitude: number) {
  return `danger:${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
}
