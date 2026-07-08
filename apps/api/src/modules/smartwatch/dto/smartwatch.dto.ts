import { BadRequestException } from "@nestjs/common";

export type RegisterSmartwatchDeviceDto = {
  deviceId: string;
  serialNumber?: string;
  imei?: string;
  eid?: string;
  simNumber?: string;
  provider: string;
  displayName?: string;
  model?: string;
  connectivityMode?: "PairedPhone" | "StandaloneCellular";
  preferredMode?: "PairedPhone" | "StandaloneCellular";
  pairingMethod?: "QrCode" | "Bluetooth" | "PairingCode" | "Nfc";
  pairingCode?: string;
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
  connectivityMode?: "PairedPhone" | "StandaloneCellular";
  preferredMode?: "PairedPhone" | "StandaloneCellular";
  batteryLevel?: number;
  signalStrength?: number;
  firmwareVersion?: string;
  firmwareSignatureStatus?: "Unknown" | "Valid" | "Invalid" | "Revoked";
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
  sourceMode?: "PairedPhone" | "StandaloneCellular";
  sosEventId?: string;
  batteryLevel?: number;
  signalStrength?: number;
  metadata?: Record<string, unknown>;
};

export type SmartwatchSosDto = SmartwatchGpsDto & {
  description?: string;
  sourceDeviceId?: string;
  emergencyMode?: "SilentSOS" | "NormalSOS" | "MedicalSOS" | "KidnappingSOS" | "FireSOS" | "ChildSOS" | "WomenSafetySOS";
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
  connectivityMode?: "PairedPhone" | "StandaloneCellular";
  pairedPhoneAvailable?: boolean;
  internetAvailable?: boolean;
  batteryLevel?: number;
  signalStrength?: number;
  firmwareVersion?: string;
  firmwareSignatureStatus?: "Unknown" | "Valid" | "Invalid" | "Revoked";
};

export type SmartwatchOfflineSyncDto = {
  deviceId?: string;
  deviceSecret?: string;
  events: Array<{
    eventType: "GPS" | "SOS" | "Media" | "Heartbeat" | "IncidentAcknowledgement";
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

const modes = new Set(["PairedPhone", "StandaloneCellular"]);
const pairingMethods = new Set(["QrCode", "Bluetooth", "PairingCode", "Nfc"]);
const emergencyModes = new Set(["SilentSOS", "NormalSOS", "MedicalSOS", "KidnappingSOS", "FireSOS", "ChildSOS", "WomenSafetySOS"]);

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
  if (dto.longPressDurationMs !== undefined && dto.longPressDurationMs < 3000) throw new BadRequestException("SOS button must be long-pressed for at least 3 seconds");
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
  if (dto.events.length > 100) throw new BadRequestException("At most 100 offline events can be synced at once");
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
