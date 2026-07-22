import { BadRequestException } from "@nestjs/common";
import { BroadcastType, IncidentPriority } from "@the-eye/shared";

const broadcastTypes = new Set<string>(Object.values(BroadcastType));
const priorities = new Set<string>(Object.values(IncidentPriority));

export type CreateBroadcastDto = {
  type: BroadcastType;
  title: string;
  body: string;
  priority: IncidentPriority;
  jurisdictionId?: string;
  incidentId?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  targetAreaWkt?: string;
  requiresApproval?: boolean;
  expiresAt?: string;
  scheduledAt?: string;
  saveAsDraft?: boolean;
};

export type ScheduleBroadcastDto = {
  scheduledAt: string;
};

export type CancelBroadcastDto = {
  reason?: string;
};

export type ReviewBroadcastDto = {
  note?: string;
};

export type RejectBroadcastDto = {
  reason: string;
};

export type NearbyBroadcastsQuery = {
  latitude?: string;
  longitude?: string;
  radiusMeters?: string;
  cursor?: string;
  limit?: string;
  category?: string;
  severity?: string;
  unreadOnly?: string;
};

export const approvalRequiredTypes = new Set<BroadcastType>([
  BroadcastType.GovernmentAlert,
  BroadcastType.CommunityWarning,
  BroadcastType.MissingPerson,
  BroadcastType.StolenVehicle,
]);

export function validateCreateBroadcastDto(dto: CreateBroadcastDto) {
  if (!broadcastTypes.has(dto.type)) throw new BadRequestException("Unsupported broadcast type");
  if (!dto.title || dto.title.trim().length < 5) throw new BadRequestException("Broadcast title is required");
  if (!dto.body || dto.body.trim().length < 10) throw new BadRequestException("Broadcast body is required");
  if (!priorities.has(dto.priority)) throw new BadRequestException("Unsupported broadcast priority");
  if (dto.latitude !== undefined) assertCoordinate(dto.latitude, "latitude", -90, 90);
  if (dto.longitude !== undefined) assertCoordinate(dto.longitude, "longitude", -180, 180);
  if ((dto.latitude === undefined) !== (dto.longitude === undefined)) throw new BadRequestException("Latitude and longitude must be provided together");
  if (dto.radiusMeters !== undefined && (dto.radiusMeters < 100 || dto.radiusMeters > 100000)) {
    throw new BadRequestException("radiusMeters must be between 100 and 100000");
  }
  if (!dto.targetAreaWkt && dto.latitude === undefined && !dto.jurisdictionId && !dto.incidentId) {
    throw new BadRequestException("A broadcast needs an incident, jurisdiction, target point, or target area");
  }
}

function assertCoordinate(value: unknown, label: string, min: number, max: number): asserts value is number {
  if (typeof value !== "number" || Number.isNaN(value) || value < min || value > max) {
    throw new BadRequestException(`${label} must be between ${min} and ${max}`);
  }
}
