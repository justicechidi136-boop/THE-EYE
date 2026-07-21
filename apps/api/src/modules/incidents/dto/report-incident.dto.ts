import { BadRequestException } from "@nestjs/common";
import { IncidentPriority, IncidentType } from "@the-eye/shared";

const allowedIncidentTypes = new Set<string>(Object.values(IncidentType));
const allowedPriorities = new Set<string>(Object.values(IncidentPriority));

export type IncidentMediaDraft = {
  mediaType: "Image" | "Video" | "Audio" | "Document" | "LiveVideoRecording";
  bucket: string;
  objectKey: string;
  contentType: string;
  sizeBytes?: number;
  fileHash: string;
  capturedAt?: string;
  latitude?: number;
  longitude?: number;
  metadata?: Record<string, unknown>;
};

export type ReportIncidentDto = {
  type: IncidentType;
  description: string;
  latitude: number;
  longitude: number;
  manualLatitude?: number;
  manualLongitude?: number;
  manualAddress?: string;
  address?: string;
  title?: string;
  priority?: IncidentPriority;
  anonymous?: boolean;
  notifyEmergencyContacts?: boolean;
  emergencyContactIds?: string[];
  occurredAt?: string;
  clientSubmissionId?: string;
  media?: IncidentMediaDraft[];
  missingPerson?: {
    fullName: string;
    age?: number;
    gender?: string;
    description?: string;
    lastSeenAt?: string;
    lastSeenAddress?: string;
  };
  stolenVehicle?: {
    plateNumber: string;
    vin?: string;
    make: string;
    model: string;
    color?: string;
    year?: number;
    lastSeenAt?: string;
    lastSeenArea?: string;
  };
};

export type PresignIncidentMediaDto = {
  mediaType: IncidentMediaDraft["mediaType"];
  contentType: string;
  fileName: string;
  sizeBytes?: number;
};

export type ConfirmIncidentMediaDto = IncidentMediaDraft;

export type UpdateIncidentLocationDto = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  capturedAt?: string;
  sourceDeviceId?: string;
  sequenceNumber?: number;
};

function assertCoordinate(value: unknown, label: string, min: number, max: number): asserts value is number {
  if (typeof value !== "number" || Number.isNaN(value) || value < min || value > max) {
    throw new BadRequestException(`${label} must be between ${min} and ${max}`);
  }
}

export function validateReportIncidentDto(dto: ReportIncidentDto) {
  if (!allowedIncidentTypes.has(dto.type)) throw new BadRequestException("Unsupported incident type");
  if (!dto.description || dto.description.trim().length < 5) throw new BadRequestException("Description is required");
  assertCoordinate(dto.latitude, "latitude", -90, 90);
  assertCoordinate(dto.longitude, "longitude", -180, 180);

  if (dto.manualLatitude !== undefined || dto.manualLongitude !== undefined) {
    assertCoordinate(dto.manualLatitude, "manualLatitude", -90, 90);
    assertCoordinate(dto.manualLongitude, "manualLongitude", -180, 180);
  }

  if (dto.priority && !allowedPriorities.has(dto.priority)) throw new BadRequestException("Unsupported incident priority");
  if (dto.media && dto.media.length > 10) throw new BadRequestException("At most 10 media files can be attached at submission");
  if (dto.emergencyContactIds && dto.emergencyContactIds.length > 5) throw new BadRequestException("At most 5 emergency contacts can be notified");
  if (dto.type === IncidentType.MissingPerson && !dto.missingPerson?.fullName) throw new BadRequestException("Missing person fullName is required");
  if (dto.type === IncidentType.StolenVehicle && !dto.stolenVehicle?.plateNumber) throw new BadRequestException("Stolen vehicle plateNumber is required");
}

export function validateMediaDraft(dto: IncidentMediaDraft) {
  if (!dto.bucket || !dto.objectKey || !dto.contentType || !dto.fileHash) throw new BadRequestException("Media bucket, objectKey, contentType, and fileHash are required");
  if (!dto.mediaType || !["Image", "Video", "Audio", "Document", "LiveVideoRecording"].includes(dto.mediaType)) throw new BadRequestException("Unsupported media type");
  if (dto.latitude !== undefined || dto.longitude !== undefined) {
    assertCoordinate(dto.latitude, "latitude", -90, 90);
    assertCoordinate(dto.longitude, "longitude", -180, 180);
  }
}

export function validateIncidentLocationDto(dto: UpdateIncidentLocationDto) {
  assertCoordinate(dto.latitude, "latitude", -90, 90);
  assertCoordinate(dto.longitude, "longitude", -180, 180);
  if (dto.accuracyMeters !== undefined && (typeof dto.accuracyMeters !== "number" || dto.accuracyMeters < 0)) {
    throw new BadRequestException("accuracyMeters must be a non-negative number");
  }
}
