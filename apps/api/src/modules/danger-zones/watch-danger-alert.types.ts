import type { DangerZoneAlertPayloadV1 } from "@the-eye/shared";

export type WatchDangerAlertJobPayload = {
  safetyAlertId: string;
  userId: string;
  deviceId?: string | null;
  dangerZoneId: string;
  incidentId: string;
  alertState?: string;
  idempotencyKey: string;
  dangerAlert: DangerZoneAlertPayloadV1;
  title: string;
  body: string;
  actorAdminId: string;
  channelMode?: "auto" | "phone_relay" | "watch_push" | "both";
  connectivityModeOverride?: "PairedPhone" | "StandaloneCellular" | "Standalone";
};

export type WatchAlertTelemetryEventType =
  | "received"
  | "displayed"
  | "speech_started"
  | "speech_completed"
  | "speech_failed"
  | "fallback_language"
  | "muted"
  | "expired"
  | "duplicate_suppressed"
  | "tts_missing"
  | "headphone_used"
  | "quiet_hours_delayed"
  | "delivered"
  | "acknowledged"
  | "relay_sent"
  | "relay_failed";

export type WatchAlertTelemetryInput = {
  safetyAlertId: string;
  userId?: string;
  deviceId?: string | null;
  event: WatchAlertTelemetryEventType;
  channel?: string;
  language?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
};
