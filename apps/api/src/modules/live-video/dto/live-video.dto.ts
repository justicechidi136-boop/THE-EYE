import { BadRequestException } from "@nestjs/common";

export type StartLiveVideoDto = {
  lowBandwidthMode?: boolean;
  standaloneEmergency?: boolean;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  capturedAt?: string;
  sourceDeviceId?: string;
};

export type LinkLiveVideoEvidenceDto = {
  mediaId: string;
};

export type LiveVideoLocationUpdateDto = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  capturedAt: string;
  sourceDeviceId?: string;
};

export function validateEvidenceLink(dto: LinkLiveVideoEvidenceDto) {
  if (!dto.mediaId) throw new BadRequestException("mediaId is required");
}

export function validateLocationUpdate(dto: LiveVideoLocationUpdateDto | StartLiveVideoDto) {
  if ("standaloneEmergency" in dto && dto.standaloneEmergency !== undefined && typeof dto.standaloneEmergency !== "boolean") {
    throw new BadRequestException("standaloneEmergency must be a boolean");
  }
  if (dto.latitude == null || dto.longitude == null) {
    return;
  }
  assertCoordinate(dto.latitude, "latitude", -90, 90);
  assertCoordinate(dto.longitude, "longitude", -180, 180);
  if (dto.latitude === 0 && dto.longitude === 0) {
    throw new BadRequestException("latitude/longitude 0,0 is not allowed as a missing-location placeholder");
  }
  if (dto.accuracy !== undefined && (typeof dto.accuracy !== "number" || dto.accuracy < 0)) throw new BadRequestException("accuracy must be a positive number");
  if (dto.speed !== undefined && typeof dto.speed !== "number") throw new BadRequestException("speed must be a number");
  if (dto.heading !== undefined && (typeof dto.heading !== "number" || dto.heading < 0 || dto.heading > 360)) throw new BadRequestException("heading must be between 0 and 360");
  if (dto.altitude !== undefined && typeof dto.altitude !== "number") throw new BadRequestException("altitude must be a number");
}

function assertCoordinate(value: unknown, label: string, min: number, max: number): asserts value is number {
  if (typeof value !== "number" || Number.isNaN(value) || value < min || value > max) {
    throw new BadRequestException(`${label} must be between ${min} and ${max}`);
  }
}
