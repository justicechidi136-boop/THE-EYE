import {
  DEFAULT_WATCH_ACCESSIBILITY_PREFERENCES,
  SPOKEN_LANGUAGE_CODES,
  type SpokenLanguageCodeValue,
  type WatchAccessibilityPreferences,
} from "@the-eye/shared";

export type WatchAccessibilityPreferencesDto = Partial<WatchAccessibilityPreferences>;

export function mergeWatchAccessibilityPreferences(
  stored: unknown,
  patch?: WatchAccessibilityPreferencesDto,
): WatchAccessibilityPreferences {
  const base =
    stored && typeof stored === "object"
      ? { ...DEFAULT_WATCH_ACCESSIBILITY_PREFERENCES, ...(stored as WatchAccessibilityPreferences) }
      : { ...DEFAULT_WATCH_ACCESSIBILITY_PREFERENCES };

  const merged = { ...base, ...(patch ?? {}) };

  if (!SPOKEN_LANGUAGE_CODES.includes(merged.preferredSpokenLanguage)) {
    merged.preferredSpokenLanguage = DEFAULT_WATCH_ACCESSIBILITY_PREFERENCES.preferredSpokenLanguage;
  }

  merged.speechRate = clamp(merged.speechRate, 0.2, 1.0);
  merged.speechPitch = clamp(merged.speechPitch, 0.5, 2.0);
  merged.repeatCount = Math.round(clamp(merged.repeatCount, 0, 5));
  merged.repeatIntervalSeconds = Math.round(clamp(merged.repeatIntervalSeconds, 5, 120));

  if (merged.vibrationStrength !== "normal" && merged.vibrationStrength !== "reduced" && merged.vibrationStrength !== "strong") {
    merged.vibrationStrength = DEFAULT_WATCH_ACCESSIBILITY_PREFERENCES.vibrationStrength;
  }

  return merged;
}

export function readAccessibilityPreferencesFromMetadata(metadata: unknown): WatchAccessibilityPreferences {
  if (!metadata || typeof metadata !== "object") {
    return { ...DEFAULT_WATCH_ACCESSIBILITY_PREFERENCES };
  }
  const record = metadata as Record<string, unknown>;
  return mergeWatchAccessibilityPreferences(record.accessibilityPreferences);
}

export function writeAccessibilityPreferencesToMetadata(
  metadata: unknown,
  preferences: WatchAccessibilityPreferences,
): Record<string, unknown> {
  const base = metadata && typeof metadata === "object" ? { ...(metadata as Record<string, unknown>) } : {};
  return {
    ...base,
    accessibilityPreferences: preferences,
    accessibilityPreferencesUpdatedAt: new Date().toISOString(),
  };
}

export function resolveSpokenLanguageHint(
  preferences: WatchAccessibilityPreferences,
  payloadHint?: SpokenLanguageCodeValue,
): SpokenLanguageCodeValue {
  if (payloadHint && SPOKEN_LANGUAGE_CODES.includes(payloadHint)) return payloadHint;
  return preferences.preferredSpokenLanguage;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
