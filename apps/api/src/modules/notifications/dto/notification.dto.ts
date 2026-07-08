import { BadRequestException } from "@nestjs/common";

export type NotificationChannel = "push" | "sms" | "email" | "in_app" | "watch_push";
export type NotificationType =
  | "EmergencyAlert"
  | "IncidentStatusUpdate"
  | "BroadcastAlert"
  | "NearbyDangerWarning"
  | "MissingPersonAlert"
  | "StolenVehicleAlert"
  | "FamilySosAlert"
  | "AdminAssignmentAlert";
export type NotificationPriority = "Low" | "Normal" | "High" | "Critical";

export type CreateNotificationDto = {
  userId?: string;
  adminUserId?: string;
  incidentId?: string;
  broadcastId?: string;
  communityId?: string;
  type: NotificationType;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  title: string;
  body: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  metadata?: Record<string, unknown>;
};

export type DeliveryReceiptDto = {
  status: "Sent" | "Delivered" | "Failed";
  providerMessageId?: string;
  error?: string;
  responsePayload?: Record<string, unknown>;
};

export type RegisterPushTokenDto = {
  token: string;
  platform: "ios" | "android" | "web";
  deviceId?: string;
};

const channels = new Set(["push", "sms", "email", "in_app", "watch_push"]);
const types = new Set(["EmergencyAlert", "IncidentStatusUpdate", "BroadcastAlert", "NearbyDangerWarning", "MissingPersonAlert", "StolenVehicleAlert", "FamilySosAlert", "AdminAssignmentAlert"]);
const priorities = new Set(["Low", "Normal", "High", "Critical"]);

function assertText(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length < 2) throw new BadRequestException(`${label} is required`);
}

function assertCoordinate(value: unknown, label: string, min: number, max: number): asserts value is number {
  if (typeof value !== "number" || Number.isNaN(value) || value < min || value > max) throw new BadRequestException(`${label} must be between ${min} and ${max}`);
}

export function validateCreateNotificationDto(dto: CreateNotificationDto) {
  assertText(dto.title, "title");
  assertText(dto.body, "body");
  if (!types.has(dto.type)) throw new BadRequestException("Unsupported notification type");
  if (dto.priority && !priorities.has(dto.priority)) throw new BadRequestException("Unsupported priority");
  if (dto.channels?.some((channel) => !channels.has(channel))) throw new BadRequestException("Unsupported notification channel");
  if (!dto.userId && !dto.adminUserId && (dto.latitude === undefined || dto.longitude === undefined)) throw new BadRequestException("A direct recipient or location target is required");
  if (dto.latitude !== undefined || dto.longitude !== undefined) {
    assertCoordinate(dto.latitude, "latitude", -90, 90);
    assertCoordinate(dto.longitude, "longitude", -180, 180);
    if (!dto.radiusMeters || dto.radiusMeters <= 0) throw new BadRequestException("radiusMeters is required for location targeting");
  }
}

export function validateRegisterPushTokenDto(dto: RegisterPushTokenDto) {
  assertText(dto.token, "token");
  if (!["ios", "android", "web"].includes(dto.platform)) throw new BadRequestException("Unsupported push platform");
}
