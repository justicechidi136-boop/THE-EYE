import { DangerAlertCode, type DangerAlertCodeValue } from "@the-eye/shared";
import { haversineMeters } from "../verification/verification-signals";

export const OWNER_APPROVED_MAX_DANGER_RADIUS_METERS = 4_000;
export const DANGER_LOCATION_FRESHNESS_MS = 30 * 60_000;
export const DANGER_RECIPIENT_LOCATION_FRESHNESS_MS = 5 * 60_000;
export const DANGER_RECIPIENT_MAX_ACCURACY_METERS = 150;
export const DANGER_LOCATION_MAX_SPEED_MPS = 100;
export const DANGER_ACTIVE_EVENT_MAX_AGE_MS = 6 * 60 * 60_000;
export const DANGER_AREA_RISK_WINDOW_DAYS = 30;
export const DANGER_AREA_RISK_RADIUS_METERS = 4_000;

export type DangerAreaRiskLevel = "GREEN_SAFE" | "MEDIUM_RISK" | "HIGH_RISK";

const USER_SELECTABLE_DANGER_CODES = new Set<DangerAlertCodeValue>([
  DangerAlertCode.FIRE_NEARBY,
  DangerAlertCode.ARMED_ROBBERY_NEARBY,
  DangerAlertCode.KIDNAPPING_NEARBY,
  DangerAlertCode.ACTIVE_SHOOTER_NEARBY,
  DangerAlertCode.CIVIL_DISTURBANCE_NEARBY,
  DangerAlertCode.BANDIT_ATTACK_NEARBY,
  DangerAlertCode.CULT_CLASH_NEARBY,
  DangerAlertCode.COMMUNITY_CRISIS_NEARBY,
  DangerAlertCode.KILLING_NEARBY,
]);

export function isUserSelectableDangerCode(
  value: unknown,
): value is DangerAlertCodeValue {
  return USER_SELECTABLE_DANGER_CODES.has(value as DangerAlertCodeValue);
}

export function classifyDangerAreaRisk(eventCount: number): DangerAreaRiskLevel {
  if (eventCount >= 5) return "HIGH_RISK";
  if (eventCount >= 2) return "MEDIUM_RISK";
  return "GREEN_SAFE";
}

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
  recipientAccuracyMeters?: number | null;
  now?: Date;
  radiusMeters?: number;
}) {
  const now = input.now ?? new Date();
  const radiusMeters = resolveDangerRadius(input.radiusMeters);
  const locationAgeMs = now.getTime() - input.recipientLocationAt.getTime();
  const locationFresh = locationAgeMs >= 0 && locationAgeMs <= DANGER_RECIPIENT_LOCATION_FRESHNESS_MS;
  const locationAccurate =
    input.recipientAccuracyMeters == null ||
    (Number.isFinite(input.recipientAccuracyMeters) &&
      input.recipientAccuracyMeters >= 0 &&
      input.recipientAccuracyMeters <= DANGER_RECIPIENT_MAX_ACCURACY_METERS);
  const distanceMeters = haversineMeters(
    input.dangerLatitude,
    input.dangerLongitude,
    input.recipientLatitude,
    input.recipientLongitude,
  );
  return {
    eligible: locationFresh && locationAccurate && distanceMeters <= radiusMeters,
    distanceMeters,
    locationFresh,
    locationAccurate,
    radiusMeters,
  };
}

export function isPlausibleDangerLocationTransition(input: {
  previousLatitude?: number | null;
  previousLongitude?: number | null;
  previousCapturedAt?: Date | null;
  latitude: number;
  longitude: number;
  capturedAt: Date;
}) {
  if (
    input.previousLatitude == null ||
    input.previousLongitude == null ||
    !input.previousCapturedAt
  ) {
    return true;
  }
  const elapsedSeconds =
    (input.capturedAt.getTime() - input.previousCapturedAt.getTime()) / 1000;
  if (elapsedSeconds <= 0) return false;
  const distanceMeters = haversineMeters(
    input.previousLatitude,
    input.previousLongitude,
    input.latitude,
    input.longitude,
  );
  return distanceMeters / elapsedSeconds <= DANGER_LOCATION_MAX_SPEED_MPS;
}

export function dangerClusterKey(latitude: number, longitude: number) {
  return `danger:${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
}
