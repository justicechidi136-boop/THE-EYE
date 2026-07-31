export const WatchFeatureFlag = {
  SpokenDangerAlerts: "WATCH_SPOKEN_DANGER_ALERTS",
  LocalTts: "WATCH_LOCAL_TTS",
  AlertAcknowledgement: "WATCH_ALERT_ACKNOWLEDGEMENT",
  StandaloneAlerts: "WATCH_STANDALONE_ALERTS",
  PhoneRelay: "WATCH_PHONE_RELAY",
  HeadphonePrivacy: "WATCH_HEADPHONE_PRIVACY",
  QuietHours: "WATCH_QUIET_HOURS",
  AdminTestAlert: "WATCH_ADMIN_TEST_ALERT",
  AdminTelemetry: "WATCH_ADMIN_TELEMETRY",
} as const;

export type WatchFeatureFlagKey = (typeof WatchFeatureFlag)[keyof typeof WatchFeatureFlag];

export type WatchFeatureFlags = Record<WatchFeatureFlagKey, boolean>;

export const DEFAULT_WATCH_FEATURE_FLAGS: WatchFeatureFlags = {
  WATCH_SPOKEN_DANGER_ALERTS: true,
  WATCH_LOCAL_TTS: true,
  WATCH_ALERT_ACKNOWLEDGEMENT: true,
  WATCH_STANDALONE_ALERTS: true,
  WATCH_PHONE_RELAY: true,
  WATCH_HEADPHONE_PRIVACY: true,
  WATCH_QUIET_HOURS: true,
  WATCH_ADMIN_TEST_ALERT: false,
  WATCH_ADMIN_TELEMETRY: true,
};

export const WATCH_FEATURE_FLAG_ENV_KEYS = Object.values(WatchFeatureFlag);
