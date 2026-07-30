export const DANGER_ALERT_SCHEMA_VERSION = 1;

/** Structured danger-zone alert codes — only these may trigger watch speech. */
export const DangerAlertCode = {
  ARMED_ROBBERY_NEARBY: "DANGER_ZONE_ARMED_ROBBERY_NEARBY",
  KIDNAPPING_NEARBY: "DANGER_ZONE_KIDNAPPING_NEARBY",
  VIOLENT_ATTACK_NEARBY: "DANGER_ZONE_VIOLENT_ATTACK_NEARBY",
  ACTIVE_SHOOTER_NEARBY: "DANGER_ZONE_ACTIVE_SHOOTER_NEARBY",
  COMMUNAL_VIOLENCE_NEARBY: "DANGER_ZONE_COMMUNAL_VIOLENCE_NEARBY",
  TERRORIST_THREAT_NEARBY: "DANGER_ZONE_TERRORIST_THREAT_NEARBY",
  FIRE_NEARBY: "DANGER_ZONE_FIRE_NEARBY",
  FLOOD_NEARBY: "DANGER_ZONE_FLOOD_NEARBY",
  GAS_LEAK_NEARBY: "DANGER_ZONE_GAS_LEAK_NEARBY",
  HAZARDOUS_AREA_NEARBY: "DANGER_ZONE_HAZARDOUS_AREA_NEARBY",
  ROAD_DANGER_NEARBY: "DANGER_ZONE_ROAD_DANGER_NEARBY",
  BUILDING_COLLAPSE_NEARBY: "DANGER_ZONE_BUILDING_COLLAPSE_NEARBY",
  CIVIL_DISTURBANCE_NEARBY: "DANGER_ZONE_CIVIL_DISTURBANCE_NEARBY",
  POLICE_ADVISORY_NEARBY: "DANGER_ZONE_POLICE_ADVISORY_NEARBY",
  MISSING_CHILD_NEARBY: "DANGER_ZONE_MISSING_CHILD_NEARBY",
  EVACUATION_NEARBY: "DANGER_ZONE_EVACUATION_NEARBY",
  GENERAL_ENTRY: "DANGER_ZONE_GENERAL_ENTRY",
  PROXIMITY_INCREASE: "DANGER_ZONE_PROXIMITY_INCREASE",
  CLEARED: "DANGER_ZONE_CLEARED",
} as const;

export type DangerAlertCodeValue = (typeof DangerAlertCode)[keyof typeof DangerAlertCode];

export const DangerAlertPriority = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
} as const;

export type DangerAlertPriorityValue = (typeof DangerAlertPriority)[keyof typeof DangerAlertPriority];

/** BCP-47 / regional codes for spoken danger alerts. */
export const SpokenLanguageCode = {
  English: "en-NG",
  NigerianPidgin: "pcm-NG",
  Hausa: "ha-NG",
  Yoruba: "yo-NG",
  Igbo: "ig-NG",
  French: "fr",
  Swahili: "sw",
} as const;

export type SpokenLanguageCodeValue = (typeof SpokenLanguageCode)[keyof typeof SpokenLanguageCode];

export const SPOKEN_LANGUAGE_CODES: SpokenLanguageCodeValue[] = Object.values(SpokenLanguageCode);

export type WatchAccessibilityPreferences = {
  spokenDangerAlertsEnabled: boolean;
  preferredSpokenLanguage: SpokenLanguageCodeValue;
  voiceGenderPreference?: "female" | "male" | "neutral";
  speechRate: number;
  speechPitch: number;
  repeatCount: number;
  repeatIntervalSeconds: number;
  vibrationStrength: "normal" | "reduced" | "strong";
  criticalAlertsOverrideSilentMode: boolean;
  speakWhenPhoneConnected: boolean;
  speakWhenStandalone: boolean;
  speakOverHeadphones: boolean;
  speakSensitiveAlertsAloud: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  allowCriticalAlertDuringQuietHours: boolean;
  acknowledgeRequired: boolean;
  autoLanguageFallback: boolean;
};

export const DEFAULT_WATCH_ACCESSIBILITY_PREFERENCES: WatchAccessibilityPreferences = {
  spokenDangerAlertsEnabled: true,
  preferredSpokenLanguage: SpokenLanguageCode.English,
  speechRate: 0.45,
  speechPitch: 1.0,
  repeatCount: 3,
  repeatIntervalSeconds: 10,
  vibrationStrength: "strong",
  criticalAlertsOverrideSilentMode: true,
  speakWhenPhoneConnected: true,
  speakWhenStandalone: true,
  speakOverHeadphones: true,
  speakSensitiveAlertsAloud: true,
  allowCriticalAlertDuringQuietHours: true,
  acknowledgeRequired: true,
  autoLanguageFallback: true,
};

export type DangerZoneAlertPayloadV1 = {
  schemaVersion: typeof DANGER_ALERT_SCHEMA_VERSION;
  type: "DANGER_ZONE_ALERT";
  alertCode: DangerAlertCodeValue;
  priority: DangerAlertPriorityValue;
  incidentId: string;
  zoneId: string;
  safetyAlertId: string;
  distanceMeters?: number;
  areaName?: string;
  languageHint?: SpokenLanguageCodeValue;
  issuedAt: string;
  expiresAt?: string;
  acknowledgementRequired: boolean;
  repeatCount: number;
  alertState?: string;
  allClear?: boolean;
  deepLink?: string;
};
