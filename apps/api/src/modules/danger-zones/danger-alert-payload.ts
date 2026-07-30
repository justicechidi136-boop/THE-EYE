import {
  DANGER_ALERT_SCHEMA_VERSION,
  DangerAlertCode,
  DangerAlertPriority,
  IncidentType,
  type DangerAlertCodeValue,
  type DangerAlertPriorityValue,
  type DangerZoneAlertPayloadV1,
  type SpokenLanguageCodeValue,
} from "@the-eye/shared";

const INCIDENT_TYPE_TO_ALERT_CODE: Partial<Record<IncidentType, DangerAlertCodeValue>> = {
  [IncidentType.Kidnapping]: DangerAlertCode.KIDNAPPING_NEARBY,
  [IncidentType.Fire]: DangerAlertCode.FIRE_NEARBY,
  [IncidentType.MissingPerson]: DangerAlertCode.MISSING_CHILD_NEARBY,
  [IncidentType.Crime]: DangerAlertCode.ARMED_ROBBERY_NEARBY,
  [IncidentType.Emergency]: DangerAlertCode.VIOLENT_ATTACK_NEARBY,
  [IncidentType.Accident]: DangerAlertCode.ROAD_DANGER_NEARBY,
  [IncidentType.Medical]: DangerAlertCode.HAZARDOUS_AREA_NEARBY,
  [IncidentType.CommunitySafety]: DangerAlertCode.CIVIL_DISTURBANCE_NEARBY,
  [IncidentType.Abuse]: DangerAlertCode.VIOLENT_ATTACK_NEARBY,
  [IncidentType.SuspiciousActivity]: DangerAlertCode.POLICE_ADVISORY_NEARBY,
};

const STATE_TO_PRIORITY: Record<string, DangerAlertPriorityValue> = {
  InsideDangerZone: DangerAlertPriority.CRITICAL,
  Critical: DangerAlertPriority.CRITICAL,
  Approaching: DangerAlertPriority.HIGH,
  Awareness: DangerAlertPriority.MEDIUM,
  MovingAway: DangerAlertPriority.LOW,
};

const PRIORITY_REPEAT: Record<DangerAlertPriorityValue, number> = {
  CRITICAL: 3,
  HIGH: 2,
  MEDIUM: 1,
  LOW: 1,
};

export function resolveDangerAlertCode(input: {
  incidentType?: string | null;
  alertState?: string;
  allClear?: boolean;
  metadata?: Record<string, unknown>;
}): DangerAlertCodeValue {
  if (input.allClear) return DangerAlertCode.CLEARED;
  if (input.alertState === "Approaching") return DangerAlertCode.PROXIMITY_INCREASE;
  const metadataCode = input.metadata?.dangerAlertCode;
  if (typeof metadataCode === "string" && isDangerAlertCode(metadataCode)) {
    return metadataCode;
  }
  const incidentType = input.incidentType as IncidentType | undefined;
  if (incidentType && INCIDENT_TYPE_TO_ALERT_CODE[incidentType]) {
    return INCIDENT_TYPE_TO_ALERT_CODE[incidentType]!;
  }
  if (input.alertState === "InsideDangerZone" || input.alertState === "Critical") {
    return DangerAlertCode.GENERAL_ENTRY;
  }
  return DangerAlertCode.GENERAL_ENTRY;
}

export function resolveDangerAlertPriority(input: {
  alertState?: string;
  notificationPriority?: string;
  severity?: string;
}): DangerAlertPriorityValue {
  if (input.alertState && STATE_TO_PRIORITY[input.alertState]) {
    return STATE_TO_PRIORITY[input.alertState]!;
  }
  if (input.notificationPriority === "Critical") return DangerAlertPriority.CRITICAL;
  if (input.notificationPriority === "High") return DangerAlertPriority.HIGH;
  if (input.severity === "P1Immediate") return DangerAlertPriority.CRITICAL;
  if (input.severity === "P2Serious") return DangerAlertPriority.HIGH;
  return DangerAlertPriority.MEDIUM;
}

export function buildDangerZoneAlertPayload(input: {
  zoneId: string;
  incidentId: string;
  safetyAlertId: string;
  incidentType?: string | null;
  alertState?: string;
  distanceMeters?: number;
  areaName?: string;
  languageHint?: SpokenLanguageCodeValue;
  notificationPriority?: string;
  severity?: string;
  allClear?: boolean;
  acknowledgementRequired?: boolean;
  repeatCount?: number;
  expiresAt?: Date | null;
  deepLink?: string;
  metadata?: Record<string, unknown>;
}): DangerZoneAlertPayloadV1 {
  const priority = resolveDangerAlertPriority(input);
  const alertCode = resolveDangerAlertCode(input);
  const issuedAt = new Date();
  const repeatCount = input.repeatCount ?? PRIORITY_REPEAT[priority];

  return {
    schemaVersion: DANGER_ALERT_SCHEMA_VERSION,
    type: "DANGER_ZONE_ALERT",
    alertCode,
    priority,
    incidentId: input.incidentId,
    zoneId: input.zoneId,
    safetyAlertId: input.safetyAlertId,
    distanceMeters: input.distanceMeters != null ? Math.round(input.distanceMeters) : undefined,
    areaName: sanitizeAreaName(input.areaName),
    languageHint: input.languageHint,
    issuedAt: issuedAt.toISOString(),
    expiresAt: input.expiresAt?.toISOString(),
    acknowledgementRequired: input.acknowledgementRequired ?? priority === DangerAlertPriority.CRITICAL,
    repeatCount,
    alertState: input.alertState,
    allClear: input.allClear ?? false,
    deepLink: input.deepLink,
  };
}

export function dangerAlertPayloadToFcmData(payload: DangerZoneAlertPayloadV1): Record<string, string> {
  return {
    dangerAlertSchemaVersion: String(payload.schemaVersion),
    dangerAlertType: payload.type,
    dangerAlertCode: payload.alertCode,
    dangerAlertPriority: payload.priority,
    zoneId: payload.zoneId,
    safetyAlertId: payload.safetyAlertId,
    acknowledgementRequired: payload.acknowledgementRequired ? "true" : "false",
    repeatCount: String(payload.repeatCount),
    issuedAt: payload.issuedAt,
    ...(payload.incidentId ? { incidentId: payload.incidentId } : {}),
    ...(payload.distanceMeters != null ? { distanceMeters: String(payload.distanceMeters) } : {}),
    ...(payload.areaName ? { areaName: payload.areaName } : {}),
    ...(payload.languageHint ? { languageHint: payload.languageHint } : {}),
    ...(payload.expiresAt ? { expiresAt: payload.expiresAt } : {}),
    ...(payload.alertState ? { alertState: payload.alertState } : {}),
    ...(payload.allClear ? { allClear: "true" } : {}),
    ...(payload.deepLink ? { deepLink: payload.deepLink } : {}),
  };
}

export function parseDangerAlertPayloadFromMetadata(
  metadata: Record<string, unknown>,
): DangerZoneAlertPayloadV1 | null {
  const nested = metadata.dangerAlert;
  if (nested && typeof nested === "object") {
    return validateDangerAlertPayload(nested as Record<string, unknown>);
  }
  return null;
}

export function validateDangerAlertPayload(raw: Record<string, unknown>): DangerZoneAlertPayloadV1 | null {
  const schemaVersion = Number(raw.schemaVersion ?? raw.dangerAlertSchemaVersion);
  if (schemaVersion !== DANGER_ALERT_SCHEMA_VERSION) return null;

  const alertCode = String(raw.alertCode ?? raw.dangerAlertCode ?? "");
  if (!isDangerAlertCode(alertCode)) return null;

  const type = String(raw.type ?? raw.dangerAlertType ?? "");
  if (type !== "DANGER_ZONE_ALERT" && !raw.allClear) return null;

  const expiresAt = raw.expiresAt ? String(raw.expiresAt) : undefined;
  if (expiresAt && Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) < Date.now()) {
    return null;
  }

  const priority = String(raw.priority ?? raw.dangerAlertPriority ?? DangerAlertPriority.MEDIUM);
  const normalizedPriority = isDangerAlertPriority(priority) ? priority : DangerAlertPriority.MEDIUM;

  return {
    schemaVersion: DANGER_ALERT_SCHEMA_VERSION,
    type: "DANGER_ZONE_ALERT",
    alertCode,
    priority: normalizedPriority,
    incidentId: String(raw.incidentId ?? ""),
    zoneId: String(raw.zoneId ?? ""),
    safetyAlertId: String(raw.safetyAlertId ?? ""),
    distanceMeters: raw.distanceMeters != null ? Number(raw.distanceMeters) : undefined,
    areaName: raw.areaName ? sanitizeAreaName(String(raw.areaName)) : undefined,
    languageHint: raw.languageHint as SpokenLanguageCodeValue | undefined,
    issuedAt: String(raw.issuedAt ?? new Date().toISOString()),
    expiresAt,
    acknowledgementRequired: raw.acknowledgementRequired === true || raw.acknowledgementRequired === "true",
    repeatCount: Number(raw.repeatCount ?? PRIORITY_REPEAT[normalizedPriority]),
    alertState: raw.alertState ? String(raw.alertState) : undefined,
    allClear: raw.allClear === true || raw.allClear === "true",
    deepLink: raw.deepLink ? String(raw.deepLink) : undefined,
  };
}

function sanitizeAreaName(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, 80);
  return trimmed.length ? trimmed : undefined;
}

function isDangerAlertCode(value: string): value is DangerAlertCodeValue {
  return Object.values(DangerAlertCode).includes(value as DangerAlertCodeValue);
}

function isDangerAlertPriority(value: string): value is DangerAlertPriorityValue {
  return Object.values(DangerAlertPriority).includes(value as DangerAlertPriorityValue);
}
