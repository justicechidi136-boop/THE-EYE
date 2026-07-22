import { BadRequestException } from "@nestjs/common";
import { EmergencyCategory, IncidentAssignmentStatus, IncidentPriority, ResponderAvailability } from "@the-eye/shared";
import { ASSIGNMENT_ACTION_TO_STATUS } from "../assignment-lifecycle";

const emergencyCategories = new Set<string>(Object.values(EmergencyCategory));
const assignmentStatuses = new Set<string>(Object.values(IncidentAssignmentStatus));
const priorities = new Set<string>(Object.values(IncidentPriority));
const availabilityStatuses = new Set<string>(Object.values(ResponderAvailability));

function assertCoordinate(value: unknown, label: string, min: number, max: number): asserts value is number {
  if (typeof value !== "number" || Number.isNaN(value) || value < min || value > max) {
    throw new BadRequestException(`${label} must be between ${min} and ${max}`);
  }
}

function assertText(value: unknown, label: string, min = 2): asserts value is string {
  if (typeof value !== "string" || value.trim().length < min) {
    throw new BadRequestException(`${label} is required`);
  }
}

export type SosReportDto = {
  emergencyCategory: EmergencyCategory;
  description?: string;
  latitude: number;
  longitude: number;
  manualLatitude?: number;
  manualLongitude?: number;
  manualAddress?: string;
  address?: string;
  silent?: boolean;
  anonymous?: boolean;
  notifyEmergencyContacts?: boolean;
  emergencyContactIds?: string[];
  clientSubmissionId?: string;
  occurredAt?: string;
  activeThreat?: boolean;
  injuryIndicators?: string[];
  weaponIndicators?: boolean;
  medicalIndicators?: boolean;
  batteryLevel?: number;
  networkType?: string;
  deviceId?: string;
  capturedAt?: string;
};

export function validateSosReportDto(dto: SosReportDto) {
  if (!emergencyCategories.has(dto.emergencyCategory)) throw new BadRequestException("Unsupported emergency category");
  assertCoordinate(dto.latitude, "latitude", -90, 90);
  assertCoordinate(dto.longitude, "longitude", -180, 180);
  if (dto.manualLatitude !== undefined || dto.manualLongitude !== undefined) {
    assertCoordinate(dto.manualLatitude, "manualLatitude", -90, 90);
    assertCoordinate(dto.manualLongitude, "manualLongitude", -180, 180);
  }
  if (dto.description && dto.description.trim().length < 3) {
    throw new BadRequestException("Description must be at least 3 characters when provided");
  }
  if (!dto.description && dto.emergencyCategory === EmergencyCategory.Other) {
    throw new BadRequestException("Description is required for Other emergencies");
  }
  if (dto.emergencyContactIds && dto.emergencyContactIds.length > 5) {
    throw new BadRequestException("At most 5 emergency contacts can be notified");
  }
  if (dto.batteryLevel !== undefined && (dto.batteryLevel < 0 || dto.batteryLevel > 100)) {
    throw new BadRequestException("batteryLevel must be between 0 and 100");
  }
}

export type DispatchIncidentQuery = {
  cursor?: string;
  limit?: string;
  status?: string;
  priority?: string;
  type?: string;
  agencyId?: string;
  jurisdictionId?: string;
  unassignedOnly?: string;
};

export type AssignDispatchIncidentDto = {
  agencyId: string;
  responderId?: string;
  responseUnitId?: string;
  priority?: IncidentPriority;
  clientAssignmentId?: string;
  reason?: string;
  overrideReason?: string;
  routingRecommendationRank?: number;
};

export type EscalateDispatchIncidentDto = {
  reason: string;
  destinationAgencyId?: string;
  destinationAdminId?: string;
  requestBackup?: boolean;
};

export type UpdateDispatchAssignmentDto = {
  status?: IncidentAssignmentStatus;
  action?: "accept" | "decline" | "en_route" | "arrive" | "in_progress" | "complete" | "cancel";
  version: number;
  declineReason?: string;
  note?: string;
  clientActionId?: string;
};

export type AssignmentNoteDto = {
  note: string;
  clientActionId?: string;
};

export type AssignmentLocationDto = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  capturedAt?: string;
  sequenceNumber?: number;
  speedMps?: number;
  headingDegrees?: number;
  batteryLevel?: number;
  networkType?: string;
  sourceDeviceId?: string;
};

export type ResponderMeAvailabilityDto = {
  availability: ResponderAvailability;
  note?: string;
};

export type UpdateResponderAvailabilityDto = {
  availability: ResponderAvailability;
  note?: string;
};

export function validateAssignDispatchIncidentDto(dto: AssignDispatchIncidentDto) {
  assertText(dto.agencyId, "agencyId", 1);
  if (dto.priority && !priorities.has(dto.priority)) throw new BadRequestException("Unsupported priority");
  if (!dto.responderId && !dto.responseUnitId) {
    throw new BadRequestException("responderId or responseUnitId is required");
  }
}

export function validateEscalateDispatchIncidentDto(dto: EscalateDispatchIncidentDto) {
  assertText(dto.reason, "reason", 5);
}

export function validateUpdateDispatchAssignmentDto(dto: UpdateDispatchAssignmentDto) {
  if (typeof dto.version !== "number" || dto.version < 1) throw new BadRequestException("version is required");
  if (!dto.action && !dto.status) throw new BadRequestException("action or status is required");
  const resolvedStatus = dto.status ?? (dto.action ? ASSIGNMENT_ACTION_TO_STATUS[dto.action] : undefined);
  if (!resolvedStatus || !assignmentStatuses.has(resolvedStatus)) {
    throw new BadRequestException("Unsupported assignment action/status");
  }
  if (resolvedStatus === IncidentAssignmentStatus.Declined) {
    assertText(dto.declineReason, "declineReason", 3);
  }
}

export function resolveAssignmentStatus(dto: UpdateDispatchAssignmentDto): IncidentAssignmentStatus {
  if (dto.status) return dto.status;
  if (dto.action) {
    const status = ASSIGNMENT_ACTION_TO_STATUS[dto.action];
    if (!status) throw new BadRequestException("Unsupported assignment action");
    return status;
  }
  throw new BadRequestException("action or status is required");
}

export function validateAssignmentNoteDto(dto: AssignmentNoteDto) {
  assertText(dto.note, "note", 3);
}

export function validateAssignmentLocationDto(dto: AssignmentLocationDto) {
  assertCoordinate(dto.latitude, "latitude", -90, 90);
  assertCoordinate(dto.longitude, "longitude", -180, 180);
  if (dto.accuracyMeters !== undefined && dto.accuracyMeters < 0) {
    throw new BadRequestException("accuracyMeters must be non-negative");
  }
}

export function validateUpdateResponderAvailabilityDto(dto: UpdateResponderAvailabilityDto) {
  if (!availabilityStatuses.has(dto.availability)) throw new BadRequestException("Unsupported availability status");
}

export type TriageOverrideDto = {
  priority: IncidentPriority;
  responseUrgency?: "immediate" | "urgent" | "standard" | "monitor";
  suggestedAgencyTypes?: string[];
  escalationDeadlineSeconds?: number;
  overrideReason: string;
};

export function validateTriageOverrideDto(dto: TriageOverrideDto) {
  if (!priorities.has(dto.priority)) throw new BadRequestException("Unsupported priority");
  assertText(dto.overrideReason, "overrideReason", 5);
}
