import { resolveAppEnvironment, type AppEnvironment } from "../auth/firebase-environment";

export function resolveNotificationsQueueName(appEnvironment: AppEnvironment): string {
  return `the-eye-${appEnvironment}-push`;
}

export function resolveNotificationsQueueNameFromConfig(config: Record<string, unknown>): string {
  return resolveNotificationsQueueName(resolveAppEnvironment(config));
}

export const NOTIFICATIONS_QUEUE_NAME = resolveNotificationsQueueNameFromConfig(process.env as Record<string, unknown>);
