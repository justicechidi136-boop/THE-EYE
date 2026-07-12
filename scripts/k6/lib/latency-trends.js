import { Trend } from "k6/metrics";

/** End-to-end HTTP latency by subsystem (k6 client-side). */
export const apiLatency = new Trend("api_latency", true);
export const dbLatency = new Trend("db_latency_proxy", true);
export const redisLatency = new Trend("redis_latency_proxy", true);
export const broadcastLatency = new Trend("broadcast_latency", true);
export const verificationLatency = new Trend("verification_latency", true);
export const notificationLatency = new Trend("notification_latency", true);
export const liveVideoLatency = new Trend("live_video_latency", true);

export function recordTaggedDuration(trend, response) {
  if (response?.timings?.duration >= 0) {
    trend.add(response.timings.duration);
  }
}
