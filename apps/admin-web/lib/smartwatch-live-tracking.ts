export type SmartwatchTrackingLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: string | null;
  pollIntervalMs: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function toSmartwatchTrackingLocation(payload: unknown): SmartwatchTrackingLocation | null {
  const data = asRecord(asRecord(payload).data);
  const latest = asRecord(data.latest);
  const event = asRecord(data.event);
  const latitude = finiteNumber(latest.latitude) ?? finiteNumber(event.latitude);
  const longitude = finiteNumber(latest.longitude) ?? finiteNumber(event.longitude);
  if (latitude === null || longitude === null) return null;

  const accuracyMeters = finiteNumber(latest.accuracy) ?? finiteNumber(event.accuracy);
  const capturedAtValue = latest.capturedAt ?? event.triggeredAt;
  const requestedInterval = finiteNumber(data.pollIntervalMs) ?? 5000;

  return {
    latitude,
    longitude,
    accuracyMeters,
    capturedAt: typeof capturedAtValue === "string" ? capturedAtValue : null,
    pollIntervalMs: Math.min(30_000, Math.max(5_000, requestedInterval)),
  };
}

export function smartwatchLocationFreshness(
  capturedAt: string | null,
  now = Date.now(),
): "Live" | "Stale" | "Unavailable" {
  if (!capturedAt) return "Unavailable";
  const timestamp = new Date(capturedAt).getTime();
  if (!Number.isFinite(timestamp)) return "Unavailable";
  return now - timestamp <= 30_000 ? "Live" : "Stale";
}
