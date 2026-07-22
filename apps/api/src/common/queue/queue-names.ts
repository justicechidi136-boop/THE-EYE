import { resolveAppEnvironment, type AppEnvironment } from "../auth/firebase-environment";

export function resolveNotificationsQueueName(appEnvironment: AppEnvironment): string {
  return `the-eye-${appEnvironment}-push`;
}

export function resolveBroadcastsQueueName(appEnvironment: AppEnvironment): string {
  return `the-eye-${appEnvironment}-broadcasts`;
}

export function resolveNotificationsQueueNameFromConfig(config: Record<string, unknown>): string {
  return resolveNotificationsQueueName(resolveAppEnvironment(config));
}

export function resolveBroadcastsQueueNameFromConfig(config: Record<string, unknown>): string {
  return resolveBroadcastsQueueName(resolveAppEnvironment(config));
}

export const NOTIFICATIONS_QUEUE_NAME = resolveNotificationsQueueNameFromConfig(process.env as Record<string, unknown>);
export const BROADCASTS_QUEUE_NAME = resolveBroadcastsQueueNameFromConfig(process.env as Record<string, unknown>);
