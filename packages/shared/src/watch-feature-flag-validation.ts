import type { WatchFeatureFlags } from "./watch-feature-flags";

export type WatchFeatureFlagIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
  flags: string[];
};

export type WatchFeatureFlagValidationResult = {
  valid: boolean;
  issues: WatchFeatureFlagIssue[];
};

export function validateWatchFeatureFlags(flags: WatchFeatureFlags): WatchFeatureFlagValidationResult {
  const issues: WatchFeatureFlagIssue[] = [];
  const anyDeliveryChannel = flags.WATCH_STANDALONE_ALERTS || flags.WATCH_PHONE_RELAY;

  if (!anyDeliveryChannel) {
    issues.push({
      code: "NO_DELIVERY_CHANNEL",
      message: "Neither WATCH_STANDALONE_ALERTS nor WATCH_PHONE_RELAY is enabled; alerts cannot reach devices.",
      severity: "error",
      flags: ["WATCH_STANDALONE_ALERTS", "WATCH_PHONE_RELAY"],
    });
  }

  if (!flags.WATCH_SPOKEN_DANGER_ALERTS && anyDeliveryChannel) {
    issues.push({
      code: "SPOKEN_OFF_DELIVERY_ON",
      message:
        "WATCH_SPOKEN_DANGER_ALERTS is off but delivery channels remain on; the watch will drop incoming alerts.",
      severity: "warning",
      flags: ["WATCH_SPOKEN_DANGER_ALERTS", "WATCH_STANDALONE_ALERTS", "WATCH_PHONE_RELAY"],
    });
  }

  if (!flags.WATCH_SPOKEN_DANGER_ALERTS && !anyDeliveryChannel) {
    issues.push({
      code: "ALL_WATCH_ALERTS_DISABLED",
      message: "All spoken danger alert paths are disabled.",
      severity: "error",
      flags: ["WATCH_SPOKEN_DANGER_ALERTS", "WATCH_STANDALONE_ALERTS", "WATCH_PHONE_RELAY"],
    });
  }

  if (!flags.WATCH_LOCAL_TTS && flags.WATCH_SPOKEN_DANGER_ALERTS) {
    issues.push({
      code: "LOCAL_TTS_OFF_SPOKEN_ON",
      message: "WATCH_LOCAL_TTS is off; the watch will suppress on-device speech even when alerts arrive.",
      severity: "warning",
      flags: ["WATCH_LOCAL_TTS", "WATCH_SPOKEN_DANGER_ALERTS"],
    });
  }

  if (!flags.WATCH_ALERT_ACKNOWLEDGEMENT && flags.WATCH_SPOKEN_DANGER_ALERTS) {
    issues.push({
      code: "ACK_OFF_SPOKEN_ON",
      message: "WATCH_ALERT_ACKNOWLEDGEMENT is off; repeat cycles may continue until expiry.",
      severity: "warning",
      flags: ["WATCH_ALERT_ACKNOWLEDGEMENT", "WATCH_SPOKEN_DANGER_ALERTS"],
    });
  }

  if (!flags.WATCH_QUIET_HOURS && flags.WATCH_SPOKEN_DANGER_ALERTS) {
    issues.push({
      code: "QUIET_HOURS_FLAG_OFF",
      message: "WATCH_QUIET_HOURS is off; quiet-hours suppression is bypassed on the watch.",
      severity: "warning",
      flags: ["WATCH_QUIET_HOURS", "WATCH_SPOKEN_DANGER_ALERTS"],
    });
  }

  if (!flags.WATCH_HEADPHONE_PRIVACY && flags.WATCH_SPOKEN_DANGER_ALERTS) {
    issues.push({
      code: "HEADPHONE_PRIVACY_OFF",
      message: "WATCH_HEADPHONE_PRIVACY is off; headphone-only privacy rules are bypassed on the watch.",
      severity: "warning",
      flags: ["WATCH_HEADPHONE_PRIVACY", "WATCH_SPOKEN_DANGER_ALERTS"],
    });
  }

  return {
    valid: !issues.some((issue) => issue.severity === "error"),
    issues,
  };
}
