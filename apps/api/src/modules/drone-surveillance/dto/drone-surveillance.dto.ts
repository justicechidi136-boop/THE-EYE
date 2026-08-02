import { BadRequestException } from "@nestjs/common";

export type CreateDroneDeviceDto = {
  deviceId: string;
  model: string;
  manufacturer?: string;
  serialNumber?: string;
  liveVideoCapable?: boolean;
};

export type CreateDroneOperatorDto = {
  name: string;
  email?: string;
  callsign?: string;
  operatorRole?: string;
  certificationLevel?: string;
  adminUserId?: string;
};

export type CreateDroneMissionDto = {
  title: string;
  description?: string;
  priority?: string;
  droneId?: string;
  operatorId?: string;
  commanderId?: string;
  incidentId?: string;
  targetLatitude?: number;
  targetLongitude?: number;
  targetAddress?: string;
  scheduledAt?: string;
};

export type LaunchMissionFromIncidentDto = {
  incidentId: string;
  droneId?: string;
  title?: string;
  description?: string;
  priority?: string;
};

export type UpdateDroneMissionStatusDto = {
  status: string;
  liveVideoStatus?: string;
};

export type CreateDroneGeofenceDto = {
  name: string;
  fenceType?: string;
  description?: string;
  geometry: Record<string, unknown>;
};

export type CreateDroneNoFlyZoneDto = {
  name: string;
  reason?: string;
  geometry: Record<string, unknown>;
};

export type LinkDroneEvidenceDto = {
  missionId: string;
  incidentId: string;
  title: string;
  mediaType: string;
  bucket?: string;
  objectKey?: string;
  fileHash?: string;
  incidentMediaId?: string;
};

function assertText(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`${field} is required`);
  }
}

export function validateCreateDroneDeviceDto(dto: CreateDroneDeviceDto) {
  assertText(dto.deviceId, "deviceId");
  assertText(dto.model, "model");
}

export function validateCreateDroneOperatorDto(dto: CreateDroneOperatorDto) {
  assertText(dto.name, "name");
}

export function validateCreateDroneMissionDto(dto: CreateDroneMissionDto) {
  assertText(dto.title, "title");
}

export function validateLaunchMissionFromIncidentDto(dto: LaunchMissionFromIncidentDto) {
  assertText(dto.incidentId, "incidentId");
}

export function validateUpdateDroneMissionStatusDto(dto: UpdateDroneMissionStatusDto) {
  assertText(dto.status, "status");
}

export function validateCreateDroneGeofenceDto(dto: CreateDroneGeofenceDto) {
  assertText(dto.name, "name");
  if (!dto.geometry || typeof dto.geometry !== "object") {
    throw new BadRequestException("geometry is required");
  }
}

export function validateCreateDroneNoFlyZoneDto(dto: CreateDroneNoFlyZoneDto) {
  assertText(dto.name, "name");
  if (!dto.geometry || typeof dto.geometry !== "object") {
    throw new BadRequestException("geometry is required");
  }
}

export function validateLinkDroneEvidenceDto(dto: LinkDroneEvidenceDto) {
  assertText(dto.missionId, "missionId");
  assertText(dto.incidentId, "incidentId");
  assertText(dto.title, "title");
  assertText(dto.mediaType, "mediaType");
}
