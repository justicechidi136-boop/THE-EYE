import { BadRequestException } from "@nestjs/common";
import {
  CheckpointSessionStatus,
  FieldShiftStatus,
  OfficerOperationalStatus,
  OperationalResponseType,
  OperationalSightingType,
  PatrolSessionStatus,
} from "@the-eye/shared";

export type StartFieldShiftDto = {
  vehicleIdentifier?: string;
  latitude?: number;
  longitude?: number;
  requiresSupervisorApproval?: boolean;
  clientActionId?: string;
};

export type EndFieldShiftDto = {
  latitude?: number;
  longitude?: number;
  clientActionId?: string;
};

export type StartPatrolSessionDto = {
  patrolZoneLabel?: string;
  latitude?: number;
  longitude?: number;
  clientActionId?: string;
};

export type PatrolLocationDto = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  recordedAt?: string;
  clientActionId?: string;
};

export type StartCheckpointSessionDto = {
  checkpointName: string;
  checkpointZoneLabel?: string;
  latitude?: number;
  longitude?: number;
  clientActionId?: string;
};

export type CheckpointQueueDto = {
  queueCount?: number;
  vehicleChecks?: number;
};

export type OperationalResponseDto = {
  responseType: OperationalResponseType;
  incidentId?: string;
  assignmentId?: string;
  note?: string;
  latitude?: number;
  longitude?: number;
  clientActionId?: string;
};

export type OperationalSightingDto = {
  sightingType: OperationalSightingType;
  title: string;
  description?: string;
  broadcastId?: string;
  searchQuery?: string;
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
  clientActionId?: string;
};

export type FieldBoloSearchDto = {
  q?: string;
  sightingType?: OperationalSightingType;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  limit?: string;
};

export type FieldSyncItemDto = {
  type:
    | "shift"
    | "patrol"
    | "checkpoint"
    | "response"
    | "sighting"
    | "patrolLocation"
    | "backup"
    | "safety";
  clientActionId: string;
  capturedAt?: string;
  payload: Record<string, unknown>;
};

export type FieldSyncBatchDto = {
  items: FieldSyncItemDto[];
  generationId?: string;
  offlineQueueDepth?: number;
};

export type FieldTelemetryDto = {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  batteryLevel?: number;
  chargingState?: string;
  gpsStatus?: string;
  radioStatus?: string;
  networkType?: string;
  weatherSummary?: string;
  isOffline?: boolean;
  appVersion?: string;
  offlineQueueDepth?: number;
  crashCount?: number;
  storagePressure?: string;
  notificationPermission?: string;
  cameraPermission?: string;
  microphonePermission?: string;
  locationPermission?: string;
};

const shiftStatuses = new Set<string>(Object.values(FieldShiftStatus));
const patrolStatuses = new Set<string>(Object.values(PatrolSessionStatus));
const checkpointStatuses = new Set<string>(Object.values(CheckpointSessionStatus));
const officerStatuses = new Set<string>(Object.values(OfficerOperationalStatus));
const responseTypes = new Set<string>(Object.values(OperationalResponseType));
const sightingTypes = new Set<string>(Object.values(OperationalSightingType));

export function validateOperationalResponseDto(dto: OperationalResponseDto) {
  if (!dto.responseType || !responseTypes.has(dto.responseType)) {
    throw new BadRequestException("Invalid operational response type");
  }
}

export function validateOperationalSightingDto(dto: OperationalSightingDto) {
  if (!dto.sightingType || !sightingTypes.has(dto.sightingType)) {
    throw new BadRequestException("Invalid sighting type");
  }
  if (!dto.title?.trim()) throw new BadRequestException("Sighting title is required");
}

export function validateStartCheckpointDto(dto: StartCheckpointSessionDto) {
  if (!dto.checkpointName?.trim()) throw new BadRequestException("Checkpoint name is required");
}

export { shiftStatuses, patrolStatuses, checkpointStatuses, officerStatuses, responseTypes, sightingTypes };
