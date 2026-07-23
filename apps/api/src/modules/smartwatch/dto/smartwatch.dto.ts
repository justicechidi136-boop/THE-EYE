import { BadRequestException } from "@nestjs/common";
import {
  FirmwareSignatureStatus,
  SmartwatchConnectivityMode,
  SmartwatchEmergencyMode,
  SmartwatchOfflineEventType,
  SmartwatchPairingMethod,
  reportIncidentValidation,
} from "@the-eye/shared";

export type RegisterSmartwatchDeviceDto = {
  deviceId: string;
  serialNumber?: string;
  imei?: string;
  eid?: string;
  simNumber?: string;
  provider: string;
  displayName?: string;
  model?: string;
  connectivityMode?: SmartwatchConnectivityMode;
  preferredMode?: SmartwatchConnectivityMode;
  pairingMethod?: SmartwatchPairingMethod;
  pairingCode?: string;
  firebaseEnv?: string;
  pairedPhoneDeviceId?: string;
  cellularProvider?: string;
  phoneNumber?: string;
  firmwareVersion?: string;
  deviceCertificate?: string;
  publicKey?: string;
  criticalAlertsEnabled?: boolean;
  failoverEnabled?: boolean;
  metadata?: Record<string, unknown>;
};

export type UpdateSmartwatchStatusDto = {
  connectivityMode?: SmartwatchConnectivityMode;
  preferredMode?: SmartwatchConnectivityMode;
  batteryLevel?: number;
  signalStrength?: number;
  firmwareVersion?: string;
  firmwareSignatureStatus?: FirmwareSignatureStatus;
  lastSeenAt?: string;
  criticalAlertsEnabled?: boolean;
  failoverEnabled?: boolean;
  isActive?: boolean;
  isOnline?: boolean;
  metadata?: Record<string, unknown>;
};

export type SmartwatchGpsDto = {
  deviceId?: string;
  deviceSecret?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  capturedAt?: string;
  sourceMode?: SmartwatchConnectivityMode;
  sosEventId?: string;
  batteryLevel?: number;
  signalStrength?: number;
  metadata?: Record<string, unknown>;
};

export type SmartwatchSosDto = SmartwatchGpsDto & {
  description?: string;
  sourceDeviceId?: string;
  emergencyMode?: SmartwatchEmergencyMode;
  longPressDurationMs?: number;
};

export type SendCriticalAlertDto = {
  title: string;
  body: string;
  incidentId?: string;
  priority?: "P1LifeThreatening" | "P2ActiveCrimeAccident" | "P3SuspiciousActivity" | "P4GeneralSafety";
};

export type SmartwatchStandaloneLoginDto = {
  deviceId: string;
  deviceSecret: string;
  deviceCertificate?: string;
};

export type SmartwatchHeartbeatDto = {
  deviceId?: string;
  deviceSecret?: string;
  connectivityMode?: SmartwatchConnectivityMode;
  pairedPhoneAvailable?: boolean;
  internetAvailable?: boolean;
  batteryLevel?: number;
  signalStrength?: number;
  firmwareVersion?: string;
  appVersion?: string;
  firmwareSignatureStatus?: FirmwareSignatureStatus;
};

export type SmartwatchOfflineSyncDto = {
  deviceId?: string;
  deviceSecret?: string;
  events: Array<{
    eventType: SmartwatchOfflineEventType;
    occurredAt: string;
    payload: Record<string, unknown>;
  }>;
};

export type SmartwatchFirmwareReleaseDto = {
  version: string;
  title: string;
  releaseNotes?: string;
  downloadUrl: string;
  fileHash: string;
  signature: string;
  status?: "Draft" | "Published" | "RolledBack";
};

export type IssueSmartwatchPairingCodeDto = {
  deviceId: string;
  pairingCode: string;
  firebaseEnv?: string;
};

export type AdminSmartwatchDeviceActionDto = {
  reason?: string;
  note?: string;
};

export type SmartwatchVersionPolicyDto = {
  deviceSecret?: string;
  currentVersion?: string;
  versionCode?: number;
  targetType?: string;
  environment?: string;
};

export type SmartwatchDeviceSettingsPolicyDto = {
  criticalAlertsMandatory?: boolean;
  maxSosCountdownSeconds?: number;
  displayNameLocked?: boolean;
  connectionPreferenceLocked?: boolean;
  approvedNotificationCategories?: string[];
};

export type SmartwatchDeviceSettingsDto = {
  displayName?: string;
  notificationCategories?: string[];
  connectionPreference?: SmartwatchConnectivityMode;
  sosCountdownSeconds?: number;
  criticalAlertsEnabled?: boolean;
  policy?: SmartwatchDeviceSettingsPolicyDto;
};

export type SmartwatchDeviceSettingsPatchDto = Partial<
  Pick<
    SmartwatchDeviceSettingsDto,
    "displayName" | "notificationCategories" | "connectionPreference" | "sosCountdownSeconds" | "criticalAlertsEnabled"
  >
> & { deviceSecret?: string };

const modes = new Set<string>(Object.values(SmartwatchConnectivityMode));
const pairingMethods = new Set<string>(Object.values(SmartwatchPairingMethod));
const emergencyModes = new Set<string>(Object.values(SmartwatchEmergencyMode));
const firebaseEnvs = new Set(["staging", "production", "development"]);

function assertText(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length < 2) throw new BadRequestException(`${label} is required`);
}

function assertCoordinate(value: unknown, label: string, min: number, max: number): asserts value is number {
  if (typeof value !== "number" || Number.isNaN(value) || value < min || value > max) throw new BadRequestException(`${label} must be between ${min} and ${max}`);
}

function assertOptionalNonNegative(value: unknown, label: string) {
  if (value !== undefined && (typeof value !== "number" || Number.isNaN(value) || value < 0)) throw new BadRequestException(`${label} must be a non-negative number`);
}

export function validateRegisterSmartwatchDeviceDto(dto: RegisterSmartwatchDeviceDto) {
  assertText(dto.deviceId, "deviceId");
  assertText(dto.provider, "provider");
  if (dto.connectivityMode && !modes.has(dto.connectivityMode)) throw new BadRequestException("Unsupported connectivity mode");
  if (dto.preferredMode && !modes.has(dto.preferredMode)) throw new BadRequestException("Unsupported preferred mode");
  if (dto.pairingMethod && !pairingMethods.has(dto.pairingMethod)) throw new BadRequestException("Unsupported pairing method");
}

export function validateSmartwatchStatusDto(dto: UpdateSmartwatchStatusDto) {
  if (dto.connectivityMode && !modes.has(dto.connectivityMode)) throw new BadRequestException("Unsupported connectivity mode");
  if (dto.preferredMode && !modes.has(dto.preferredMode)) throw new BadRequestException("Unsupported preferred mode");
  if (dto.batteryLevel !== undefined && (dto.batteryLevel < 0 || dto.batteryLevel > 100)) throw new BadRequestException("batteryLevel must be between 0 and 100");
  if (dto.signalStrength !== undefined && (dto.signalStrength < 0 || dto.signalStrength > 100)) throw new BadRequestException("signalStrength must be between 0 and 100");
}

export function validateSmartwatchGpsDto(dto: SmartwatchGpsDto) {
  assertCoordinate(dto.latitude, "latitude", -90, 90);
  assertCoordinate(dto.longitude, "longitude", -180, 180);
  assertOptionalNonNegative(dto.accuracy, "accuracy");
  assertOptionalNonNegative(dto.speed, "speed");
  if (dto.heading !== undefined && (dto.heading < 0 || dto.heading > 360)) throw new BadRequestException("heading must be between 0 and 360");
  if (dto.sourceMode && !modes.has(dto.sourceMode)) throw new BadRequestException("Unsupported source mode");
}

export function validateSmartwatchSosDto(dto: SmartwatchSosDto) {
  validateSmartwatchGpsDto(dto);
  if (dto.emergencyMode && !emergencyModes.has(dto.emergencyMode)) throw new BadRequestException("Unsupported emergency mode");
  if (dto.longPressDurationMs !== undefined && dto.longPressDurationMs < reportIncidentValidation.sosLongPressMinMs) throw new BadRequestException("SOS button must be long-pressed for at least 3 seconds");
}

export function validateCriticalAlertDto(dto: SendCriticalAlertDto) {
  assertText(dto.title, "title");
  assertText(dto.body, "body");
}

export function validateStandaloneLoginDto(dto: SmartwatchStandaloneLoginDto) {
  assertText(dto.deviceId, "deviceId");
  assertText(dto.deviceSecret, "deviceSecret");
}

export function validateHeartbeatDto(dto: SmartwatchHeartbeatDto) {
  if (dto.connectivityMode && !modes.has(dto.connectivityMode)) throw new BadRequestException("Unsupported connectivity mode");
  validateSmartwatchStatusDto(dto);
}

export function validateOfflineSyncDto(dto: SmartwatchOfflineSyncDto) {
  if (!Array.isArray(dto.events) || dto.events.length === 0) throw new BadRequestException("events are required");
  if (dto.events.length > reportIncidentValidation.offlineSyncMaxEvents) throw new BadRequestException("At most 100 offline events can be synced at once");
  for (const event of dto.events) {
    assertText(event.eventType, "eventType");
    if (!event.occurredAt || Number.isNaN(new Date(event.occurredAt).getTime())) throw new BadRequestException("occurredAt must be a valid timestamp");
  }
}

export function validateFirmwareReleaseDto(dto: SmartwatchFirmwareReleaseDto) {
  assertText(dto.version, "version");
  assertText(dto.title, "title");
  assertText(dto.downloadUrl, "downloadUrl");
  assertText(dto.fileHash, "fileHash");
  assertText(dto.signature, "signature");
}

export function validateIssuePairingCodeDto(dto: IssueSmartwatchPairingCodeDto) {
  assertText(dto.deviceId, "deviceId");
  if (typeof dto.pairingCode !== "string" || !/^\d{6}$/.test(dto.pairingCode)) {
    throw new BadRequestException("pairingCode must be a 6-digit code");
  }
  if (dto.firebaseEnv && !firebaseEnvs.has(dto.firebaseEnv)) {
    throw new BadRequestException("Unsupported firebaseEnv");
  }
}
