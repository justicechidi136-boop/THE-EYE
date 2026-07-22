import IORedis from "ioredis";
import { resolveAppEnvironment } from "../auth/firebase-environment";

export function isRedisExplicitlyDisabled(config: Record<string, unknown> = process.env as Record<string, unknown>): boolean {
  return config.THE_EYE_DISABLE_REDIS === "1" || config.THE_EYE_DISABLE_REDIS === 1;
}

export function isProductionLikeAppEnvironment(config: Record<string, unknown> = process.env as Record<string, unknown>): boolean {
  const env = resolveAppEnvironment(config);
  return env === "staging" || env === "production";
}

export function shouldRegisterNotificationWorker(config: Record<string, unknown> = process.env as Record<string, unknown>): boolean {
  return config.THE_EYE_RUN_NOTIFICATION_WORKER === "1" || config.THE_EYE_RUN_NOTIFICATION_WORKER === 1;
}

export function shouldRegisterBullMq(config: Record<string, unknown> = process.env as Record<string, unknown>): boolean {
  return !isRedisExplicitlyDisabled(config);
}

export function resolveQueuePrefix(config: Record<string, unknown> = process.env as Record<string, unknown>): string {
  const explicit = String(config.BULLMQ_PREFIX ?? config.REDIS_QUEUE_PREFIX ?? "").trim();
  if (explicit) return explicit;
  return `the-eye-${resolveAppEnvironment(config)}`;
}

export function resolveRedisConnectionOptions(config: Record<string, unknown> = process.env as Record<string, unknown>) {
  const host = String(config.REDIS_HOST ?? "localhost");
  const port = Number(config.REDIS_PORT ?? 6379);
  const password = String(config.REDIS_PASSWORD ?? "").trim() || undefined;
  const db = Number(config.REDIS_DB ?? 0);
  const tlsEnabled =
    config.REDIS_TLS === "1" ||
    config.REDIS_TLS === 1 ||
    config.REDIS_TLS === "true" ||
    config.REDIS_TLS === true;

  return {
    host,
    port,
    password,
    db,
    ...(tlsEnabled ? { tls: {} } : {}),
    maxRetriesPerRequest: null as null,
  };
}

export function resolveBullMqRootOptions(config: Record<string, unknown> = process.env as Record<string, unknown>) {
  return {
    connection: resolveRedisConnectionOptions(config),
    prefix: resolveQueuePrefix(config),
  };
}

export function createHealthRedisClient(config: Record<string, unknown> = process.env as Record<string, unknown>): IORedis {
  return new IORedis({
    ...resolveRedisConnectionOptions(config),
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
    lazyConnect: true,
  });
}

export function resolveWorkerHeartbeatKey(config: Record<string, unknown> = process.env as Record<string, unknown>): string {
  return `${resolveQueuePrefix(config)}:notification-worker:heartbeat`;
}

export function resolveNotificationQueueOptions(
  queueName: string,
  config: Record<string, unknown> = process.env as Record<string, unknown>,
) {
  return {
    ...resolveBullMqRootOptions(config),
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: false,
    },
  };
}
