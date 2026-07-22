import { BadRequestException } from "@nestjs/common";
import { EmergencyCategory, IncidentAssignmentStatus, IncidentPriority, ResponderAvailability } from "@the-eye/shared";

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
  status: IncidentAssignmentStatus;
  version: number;
  declineReason?: string;
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
  if (!assignmentStatuses.has(dto.status)) throw new BadRequestException("Unsupported assignment status");
  if (typeof dto.version !== "number" || dto.version < 1) throw new BadRequestException("version is required");
  if (dto.status === IncidentAssignmentStatus.Declined) {
    assertText(dto.declineReason, "declineReason", 3);
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
