export const DANGER_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type DangerLevel = (typeof DANGER_LEVELS)[number];

export const DANGER_CATEGORIES = [
  "ACTIVE_SHOOTING",
  "ARMED_ATTACK",
  "ARMED_ROBBERY",
  "KIDNAPPING_IN_PROGRESS",
  "EXPLOSION",
  "FIRE_WITH_LIFE_RISK",
  "BOMB_OR_EXPLOSIVE_THREAT",
  "VIOLENT_MOB_OR_RIOT",
  "VEHICLE_ATTACK",
  "SERIOUS_WEAPON_ASSAULT",
  "MAJOR_HAZARDOUS_RELEASE",
  "OTHER_IMMEDIATE_LIFE_THREAT",
] as const;
export type DangerCategory = (typeof DANGER_CATEGORIES)[number];

export const DANGER_DETECTION_STATES = [
  "DETECTED",
  "POTENTIAL",
  "VERIFYING",
  "CONFIRMED",
  "RESOLVED",
  "REJECTED",
  "FAILED",
] as const;
export type DangerDetectionState = (typeof DANGER_DETECTION_STATES)[number];

export const DANGER_SOURCE_TYPES = [
  "INCIDENT",
  "COMMUNITY_POST",
  "COMMUNITY_COMMENT",
  "BROADCAST_SIGHTING",
  "INCIDENT_AUDIO",
  "COMMUNITY_POST_AUDIO",
  "BROADCAST_SIGHTING_AUDIO",
] as const;
export type DangerSourceType = (typeof DANGER_SOURCE_TYPES)[number];

export type DangerClassification = {
  dangerLevel: DangerLevel;
  category: DangerCategory;
  immediateThreat: boolean;
  activeIncident: boolean;
  confidence: number;
  requiresVerification: boolean;
  detectedLocale?: string;
  semanticTags?: string[];
  contextSuppression?: "historical" | "news" | "fiction" | "hypothetical" | "quotation" | "joke" | null;
};

export function isDangerClassification(value: unknown): value is DangerClassification {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    DANGER_LEVELS.includes(row.dangerLevel as DangerLevel) &&
    DANGER_CATEGORIES.includes(row.category as DangerCategory) &&
    typeof row.immediateThreat === "boolean" &&
    typeof row.activeIncident === "boolean" &&
    typeof row.requiresVerification === "boolean" &&
    typeof row.confidence === "number" &&
    row.confidence >= 0 &&
    row.confidence <= 1
  );
}
