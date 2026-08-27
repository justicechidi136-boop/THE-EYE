import { BadRequestException } from "@nestjs/common";
import type { DangerAlertCodeValue } from "@the-eye/shared";
import { isUserSelectableDangerCode } from "../danger-trigger.policy";

export type StartDangerTriggerDto = {
  clientTriggerId: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  locationSource: "freshGps" | "cachedDevice" | "networkLocation";
  locationCapturedAt: string;
  areaName?: string;
  dangerAlertCode?: DangerAlertCodeValue;
  lowBandwidthMode?: boolean;
  qaTest?: boolean;
};

export type ActivateDangerTriggerDto = {
  liveVoiceSessionId: string;
  connectedAt: string;
};

export type CancelDangerTriggerDto = {
  reason?: string;
};

export function validateStartDangerTriggerDto(dto: StartDangerTriggerDto) {
  if (!dto.clientTriggerId?.trim()) throw new BadRequestException("clientTriggerId is required");
  assertCoordinate(dto.latitude, "latitude", -90, 90);
  assertCoordinate(dto.longitude, "longitude", -180, 180);
  if (dto.latitude === 0 && dto.longitude === 0) {
    throw new BadRequestException("A valid danger location is required");
  }
  if (!new Set(["freshGps", "cachedDevice", "networkLocation"]).has(dto.locationSource)) {
    throw new BadRequestException("locationSource is invalid");
  }
  if (
    dto.dangerAlertCode != null &&
    !isUserSelectableDangerCode(dto.dangerAlertCode)
  ) {
    throw new BadRequestException("Select a valid danger type");
  }
  const capturedAt = new Date(dto.locationCapturedAt);
  if (Number.isNaN(capturedAt.getTime())) throw new BadRequestException("locationCapturedAt is invalid");
  const ageMs = Date.now() - capturedAt.getTime();
  if (ageMs < -60_000 || ageMs > 30 * 60_000) {
    throw new BadRequestException("Danger location is too old to use safely");
  }
  if (dto.accuracyMeters != null && (!Number.isFinite(dto.accuracyMeters) || dto.accuracyMeters < 0)) {
    throw new BadRequestException("accuracyMeters must be positive");
  }
}

function assertCoordinate(value: unknown, label: string, min: number, max: number): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new BadRequestException(`${label} must be between ${min} and ${max}`);
  }
}
