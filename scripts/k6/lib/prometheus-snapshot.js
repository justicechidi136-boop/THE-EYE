/**
 * Parse Prometheus text exposition for p95 latency estimates.
 */

function parseHistogram(lines, metricName, labelFilter = null) {
  const buckets = [];
  let count = 0;
  let sum = 0;

  for (const line of lines) {
    if (!line.startsWith(metricName)) continue;
    if (labelFilter && !line.includes(labelFilter)) continue;

    const bucketMatch = line.match(/le="([^"]+)"/);
    if (bucketMatch && line.includes("_bucket")) {
      const le = bucketMatch[1] === "+Inf" ? Number.POSITIVE_INFINITY : Number(bucketMatch[1]);
      const value = Number(line.split(/\s+/).pop());
      buckets.push({ le, value });
      continue;
    }
    if (line.startsWith(`${metricName}_count`)) {
      count = Number(line.split(/\s+/).pop());
      continue;
    }
    if (line.startsWith(`${metricName}_sum`)) {
      sum = Number(line.split(/\s+/).pop());
    }
  }

  if (!buckets.length || !count) {
    return { p95Ms: null, avgMs: null, count: 0 };
  }

  buckets.sort((a, b) => a.le - b.le);
  const target = count * 0.95;
  let p95Seconds = buckets[buckets.length - 1].le;
  for (const bucket of buckets) {
    if (bucket.value >= target) {
      p95Seconds = bucket.le;
      break;
    }
  }

  return {
    p95Ms: Number.isFinite(p95Seconds) ? Math.round(p95Seconds * 1000) : null,
    avgMs: count ? Math.round((sum / count) * 1000) : null,
    count,
  };
}

export function snapshotPrometheusMetrics(body) {
  const lines = String(body || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    api: parseHistogram(lines, "the_eye_http_request_duration_seconds"),
    db: parseHistogram(lines, "the_eye_db_query_duration_seconds"),
    redis: parseHistogram(lines, "the_eye_redis_operation_duration_seconds"),
    verification: parseHistogram(lines, "the_eye_verification_duration_seconds"),
    broadcast: parseHistogram(lines, "the_eye_broadcast_dispatch_duration_seconds"),
    notification: parseHistogram(lines, "the_eye_notification_delivery_duration_seconds"),
    liveVideo: parseHistogram(lines, "the_eye_live_video_operation_duration_seconds"),
  };
}

export function metricsBaseUrl() {
  const explicit = __ENV.METRICS_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const apiBase = (__ENV.BASE_URL || "http://localhost:4000/v1").replace(/\/v1\/?$/, "");
  return `${apiBase}/metrics`;
}
