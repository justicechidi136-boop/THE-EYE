import { BadRequestException } from "@nestjs/common";
import { IncidentPriority, IncidentType } from "@the-eye/shared";
import {
  ALLOWED_LOCATION_QUALITIES,
  ALLOWED_LOCATION_SOURCES,
  assertLocationMetadataConsistency,
  assertNoZeroCoordinatePlaceholder,
  incidentHasSubmissionCoordinates,
} from "../location-status";

const allowedIncidentTypes = new Set<string>(Object.values(IncidentType));
const allowedPriorities = new Set<string>(Object.values(IncidentPriority));
const supportedEvidenceContentTypes = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/webm",
  "audio/aac",
  "audio/x-m4a",
  "application/pdf",
]);

const incidentEvidencePolicy = {
  maxPhotos: 6,
  maxVideos: 2,
  maxAudio: 2,
  maxFiles: 10,
  maxFileSize: 100 * 1024 * 1024,
  maxTotalBytes: 300 * 1024 * 1024,
} as const;

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
  durationSeconds?: number;
  selectedLanguage?: string;
  clientAttachmentId?: string;
};

export function hasVoiceMedia(media?: IncidentMediaDraft[]) {
  return (media ?? []).some((item) => item.mediaType === "Audio");
}

export function hasImageOrVideoMedia(media?: IncidentMediaDraft[]) {
  return (media ?? []).some((item) => item.mediaType === "Image" || item.mediaType === "Video");
}

export function hasValidReportNarrative(dto: Pick<ReportIncidentDto, "description" | "media">) {
  const description = dto.description?.trim() ?? "";
  if (description.length >= 5) return true;
  if (hasVoiceMedia(dto.media)) return true;
  if (hasImageOrVideoMedia(dto.media)) return true;
  return false;
}

export type ReportIncidentDto = {
  type: IncidentType;
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
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
  locationStatus?: string;
  locationSource?: string;
  isCached?: boolean;
  ageSeconds?: number;
  accuracyMeters?: number;
  quality?: string;
  locationErrorCode?: string;
  locationRequestId?: string;
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
  source?: string;
  quality?: string;
  isCached?: boolean;
  ageSeconds?: number;
  speedMps?: number;
  headingDegrees?: number;
  batteryLevel?: number;
  networkType?: string;
};

function assertCoordinate(value: unknown, label: string, min: number, max: number): asserts value is number {
  if (typeof value !== "number" || Number.isNaN(value) || value < min || value > max) {
    throw new BadRequestException(`${label} must be between ${min} and ${max}`);
  }
}

export function validateReportIncidentDto(dto: ReportIncidentDto) {
  if (!allowedIncidentTypes.has(dto.type)) throw new BadRequestException("Unsupported incident type");
  if (!hasValidReportNarrative(dto)) {
    throw new BadRequestException("Provide a description, voice recording, or photo/video evidence");
  }

  assertLocationMetadataConsistency({
    latitude: dto.latitude,
    longitude: dto.longitude,
    locationStatus: dto.locationStatus,
    locationSource: dto.locationSource,
    accuracyMeters: dto.accuracyMeters,
  });

  if (dto.quality && !ALLOWED_LOCATION_QUALITIES.has(dto.quality)) {
    throw new BadRequestException("Unsupported location quality");
  }

  if (incidentHasSubmissionCoordinates(dto)) {
    assertCoordinate(dto.latitude, "latitude", -90, 90);
    assertCoordinate(dto.longitude, "longitude", -180, 180);
    assertNoZeroCoordinatePlaceholder(dto.latitude, dto.longitude);
  }

  if (dto.manualLatitude !== undefined || dto.manualLongitude !== undefined) {
    assertCoordinate(dto.manualLatitude, "manualLatitude", -90, 90);
    assertCoordinate(dto.manualLongitude, "manualLongitude", -180, 180);
  }

  if (dto.priority && !allowedPriorities.has(dto.priority)) throw new BadRequestException("Unsupported incident priority");
  validateIncidentMediaPolicy(dto.media ?? []);
  if (dto.emergencyContactIds && dto.emergencyContactIds.length > 5) throw new BadRequestException("At most 5 emergency contacts can be notified");
  if (dto.type === IncidentType.MissingPerson && !dto.missingPerson?.fullName) throw new BadRequestException("Missing person fullName is required");
  if (dto.type === IncidentType.StolenVehicle && !dto.stolenVehicle?.plateNumber) throw new BadRequestException("Stolen vehicle plateNumber is required");
}

export function validateMediaDraft(dto: IncidentMediaDraft) {
  if (!dto.bucket || !dto.objectKey || !dto.contentType || !dto.fileHash) throw new BadRequestException("Media bucket, objectKey, contentType, and fileHash are required");
  if (!dto.mediaType || !["Image", "Video", "Audio", "Document", "LiveVideoRecording"].includes(dto.mediaType)) throw new BadRequestException("Unsupported media type");
  if (!supportedEvidenceContentTypes.has(dto.contentType)) {
    throw new BadRequestException("Unsupported evidence content type");
  }
  if (
    dto.sizeBytes !== undefined &&
    (!Number.isInteger(dto.sizeBytes) || dto.sizeBytes <= 0 || dto.sizeBytes > incidentEvidencePolicy.maxFileSize)
  ) {
    throw new BadRequestException("Evidence file size must be between 1 byte and 100 MB");
  }
  if (dto.mediaType === "Video" && dto.durationSeconds !== undefined) {
    if (!Number.isInteger(dto.durationSeconds) || dto.durationSeconds <= 0 || dto.durationSeconds > 120) {
      throw new BadRequestException("Video duration must be between 1 and 120 seconds");
    }
  }
  if (dto.mediaType === "Audio" && dto.durationSeconds !== undefined) {
    if (!Number.isInteger(dto.durationSeconds) || dto.durationSeconds <= 0 || dto.durationSeconds > 300) {
      throw new BadRequestException("Voice duration must be between 1 and 300 seconds");
    }
  }
  if (dto.latitude !== undefined || dto.longitude !== undefined) {
    assertCoordinate(dto.latitude, "latitude", -90, 90);
    assertCoordinate(dto.longitude, "longitude", -180, 180);
    assertNoZeroCoordinatePlaceholder(dto.latitude, dto.longitude);
  }
}

export function validateIncidentLocationDto(dto: UpdateIncidentLocationDto) {
  assertCoordinate(dto.latitude, "latitude", -90, 90);
  assertCoordinate(dto.longitude, "longitude", -180, 180);
  assertNoZeroCoordinatePlaceholder(dto.latitude, dto.longitude);
  if (dto.accuracyMeters !== undefined && (typeof dto.accuracyMeters !== "number" || dto.accuracyMeters <= 0)) {
    throw new BadRequestException("accuracyMeters must be a positive number");
  }
  if (dto.source && !ALLOWED_LOCATION_SOURCES.has(dto.source)) {
    throw new BadRequestException("Unsupported location source");
  }
  if (dto.quality && !ALLOWED_LOCATION_QUALITIES.has(dto.quality)) {
    throw new BadRequestException("Unsupported location quality");
  }
}

function validateIncidentMediaPolicy(media: IncidentMediaDraft[]) {
  if (media.length > incidentEvidencePolicy.maxFiles) {
    throw new BadRequestException(
      `At most ${incidentEvidencePolicy.maxFiles} media files can be attached at submission`,
    );
  }
  const photoCount = media.filter((item) => item.mediaType === "Image").length;
  if (photoCount > incidentEvidencePolicy.maxPhotos) {
    throw new BadRequestException(`At most ${incidentEvidencePolicy.maxPhotos} photos can be attached`);
  }
  const videoCount = media.filter(
    (item) => item.mediaType === "Video" || item.mediaType === "LiveVideoRecording",
  ).length;
  if (videoCount > incidentEvidencePolicy.maxVideos) {
    throw new BadRequestException(`At most ${incidentEvidencePolicy.maxVideos} videos can be attached`);
  }
  const audioCount = media.filter((item) => item.mediaType === "Audio").length;
  if (audioCount > incidentEvidencePolicy.maxAudio) {
    throw new BadRequestException(`At most ${incidentEvidencePolicy.maxAudio} audio files can be attached`);
  }

  let totalSize = 0;
  for (const item of media) {
    if (item.sizeBytes !== undefined) {
      if (
        !Number.isInteger(item.sizeBytes) ||
        item.sizeBytes <= 0 ||
        item.sizeBytes > incidentEvidencePolicy.maxFileSize
      ) {
        throw new BadRequestException("Evidence file size must be between 1 byte and 100 MB");
      }
      totalSize += item.sizeBytes;
      if (totalSize > incidentEvidencePolicy.maxTotalBytes) {
        throw new BadRequestException("Attached evidence exceeds total upload allowance");
      }
    }
    if (!supportedEvidenceContentTypes.has(item.contentType)) {
      throw new BadRequestException("Unsupported evidence content type");
    }
  }
}
