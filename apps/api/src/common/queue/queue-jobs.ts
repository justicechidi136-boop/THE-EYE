import type { NotificationDispatchPayload } from "../../modules/notifications/notification.types";
import { buildBullJobId } from "./bull-job-id";

export const NOTIFICATION_DISPATCH_JOB_NAME = "dispatch";
export const BROADCAST_AUTO_DISPATCH_JOB_NAME = "auto-dispatch";
export const BROADCAST_COUNTRY_DELIVERY_JOB_NAME = "country-delivery";
export const BROADCAST_RESOLUTION_DELIVERY_JOB_NAME = "resolution-delivery";
export const BROADCAST_EXPIRY_REVIEW_JOB_NAME = "expiry-review";
export const DANGER_ZONE_TARGET_JOB_NAME = "danger-zone-target";

export function buildNotificationDispatchJobId(
  payload: Pick<
    NotificationDispatchPayload,
    "notificationId" | "channel" | "userId" | "adminUserId" | "phone" | "email"
  >,
): string {
  const recipient = payload.userId ?? payload.adminUserId ?? payload.phone ?? payload.email ?? "broadcast";
  const channel = payload.channel ?? "push";
  const notificationId = payload.notificationId ?? "unknown";
  return buildBullJobId("notify", notificationId, channel, recipient);
}

export function buildNotificationIdempotencyKey(
  payload: Pick<
    NotificationDispatchPayload,
    "notificationId" | "channel" | "userId" | "adminUserId" | "phone" | "email"
  >,
): string {
  return buildNotificationDispatchJobId(payload);
}

export function buildBroadcastAutoDispatchJobId(broadcastId: string): string {
  return buildBullJobId("broadcast", "auto-dispatch", broadcastId);
}

export function buildBroadcastCountryDeliveryJobId(
  broadcastId: string,
  countryCode: string,
  batchNumber: number,
): string {
  return buildBullJobId("broadcast-country", broadcastId, countryCode, String(batchNumber));
}

export type BroadcastCountryDeliveryJobPayload = {
  broadcastId: string;
  countryCode: string;
  batchNumber: number;
  batchSize: number;
  idempotencyKey: string;
};

export type BroadcastResolutionDeliveryJobPayload = {
  broadcastId: string;
  eventType: string;
  batchNumber: number;
  batchSize: number;
  idempotencyKey: string;
};

export type BroadcastExpiryReviewJobPayload = {
  broadcastId: string;
  idempotencyKey: string;
};

export function buildBroadcastResolutionDeliveryJobId(
  broadcastId: string,
  eventType: string,
  batchNumber: number,
): string {
  return buildBullJobId("broadcast-resolution", broadcastId, eventType, String(batchNumber));
}

export function buildBroadcastExpiryReviewJobId(broadcastId: string): string {
  return buildBullJobId("broadcast-expiry-review", broadcastId);
}

export function buildDangerZoneActivateJobId(dangerZoneId: string): string {
  return buildBullJobId("danger-zone-activate", dangerZoneId);
}

export const WATCH_DANGER_ALERT_JOB_NAME = "watch-danger-alert";

export function buildWatchDangerAlertJobId(alertId: string, userId: string): string {
  return buildBullJobId("watch-danger-alert", alertId, userId);
}

export const VOICE_TRANSCRIPTION_JOB_NAME = "speech.transcribe";
export const SPEECH_TRANSLATION_JOB_NAME = "speech.translate";
export const SPEECH_SYNTHESIS_JOB_NAME = "speech.synthesize";

export function buildVoiceTranscriptionJobId(attachmentId: string): string {
  return buildBullJobId("voice-transcription", attachmentId);
}

export function buildSpeechTranslationJobId(speechArtifactId: string, targetLocale: string): string {
  return buildBullJobId("speech-translation", speechArtifactId, targetLocale);
}

export function buildSpeechSynthesisJobId(translationId: string, version = 1): string {
  return buildBullJobId("speech-synthesis", translationId, String(version));
}

export type BroadcastAutoDispatchJobPayload = {
  broadcastId: string;
  idempotencyKey: string;
};
