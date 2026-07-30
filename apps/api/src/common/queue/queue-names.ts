import { resolveAppEnvironment, type AppEnvironment } from "../auth/firebase-environment";

export function resolveNotificationsQueueName(appEnvironment: AppEnvironment): string {
  return `the-eye-${appEnvironment}-push`;
}

export function resolveBroadcastsQueueName(appEnvironment: AppEnvironment): string {
  return `the-eye-${appEnvironment}-broadcasts`;
}

export function resolveIncidentLocationRetryQueueName(appEnvironment: AppEnvironment): string {
  return `the-eye-${appEnvironment}-incident-location-retry`;
}

export function resolveDangerZonesQueueName(appEnvironment: AppEnvironment): string {
  return `the-eye-${appEnvironment}-danger-zones`;
}

export function resolveNotificationsQueueNameFromConfig(config: Record<string, unknown>): string {
  return resolveNotificationsQueueName(resolveAppEnvironment(config));
}

export function resolveBroadcastsQueueNameFromConfig(config: Record<string, unknown>): string {
  return resolveBroadcastsQueueName(resolveAppEnvironment(config));
}

export function resolveIncidentLocationRetryQueueNameFromConfig(config: Record<string, unknown>): string {
  return resolveIncidentLocationRetryQueueName(resolveAppEnvironment(config));
}

export const NOTIFICATIONS_QUEUE_NAME = resolveNotificationsQueueNameFromConfig(process.env as Record<string, unknown>);
export const BROADCASTS_QUEUE_NAME = resolveBroadcastsQueueNameFromConfig(process.env as Record<string, unknown>);
export const INCIDENT_LOCATION_RETRY_QUEUE_NAME = resolveIncidentLocationRetryQueueNameFromConfig(
  process.env as Record<string, unknown>,
);
export const DANGER_ZONES_QUEUE_NAME = resolveDangerZonesQueueNameFromConfig(process.env as Record<string, unknown>);

export function resolveDangerZonesQueueNameFromConfig(config: Record<string, unknown>): string {
  return resolveDangerZonesQueueName(resolveAppEnvironment(config));
}

export function resolveVoiceTranscriptionQueueName(appEnvironment: AppEnvironment): string {
  return `the-eye-${appEnvironment}-voice-transcription`;
}

export function resolveVoiceTranscriptionQueueNameFromConfig(config: Record<string, unknown>): string {
  return resolveVoiceTranscriptionQueueName(resolveAppEnvironment(config));
}

export const VOICE_TRANSCRIPTION_QUEUE_NAME = resolveVoiceTranscriptionQueueNameFromConfig(
  process.env as Record<string, unknown>,
);
