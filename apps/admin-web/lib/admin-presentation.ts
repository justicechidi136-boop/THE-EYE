export type LocationPoint = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  capturedAt: string;
};

export function humanPriority(priority: string): "HIGH" | "MID" | "LOW" {
  if (priority === "P1" || priority === "P1LifeThreatening") return "HIGH";
  if (priority === "P2" || priority === "P2ActiveCrimeAccident") return "MID";
  return "LOW";
}

export function humanLocation(parts: unknown[]): string {
  const values = parts
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());
  const normalizedSegment = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+state$/, "");
  const selected: string[] = [];
  const covered = new Set<string>();
  for (const value of values) {
    const segments = value.split(",").map(normalizedSegment).filter(Boolean);
    if (segments.length === 1 && covered.has(segments[0])) continue;
    selected.push(value);
    segments.forEach((segment) => covered.add(segment));
  }
  return selected.join(", ") || "Location unavailable";
}

function radians(value: number) {
  return value * Math.PI / 180;
}

function distanceMeters(a: LocationPoint, b: LocationPoint) {
  const earthRadius = 6_371_000;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function sanitizeLocationTrail(points: LocationPoint[]): LocationPoint[] {
  const ordered = points
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && !Number.isNaN(Date.parse(point.capturedAt)))
    .filter((point) => point.latitude >= -90 && point.latitude <= 90 && point.longitude >= -180 && point.longitude <= 180)
    .filter((point) => point.accuracyMeters == null || point.accuracyMeters <= 250)
    .sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));
  const result: LocationPoint[] = [];
  for (const point of ordered) {
    const previous = result.at(-1);
    if (!previous) {
      result.push(point);
      continue;
    }
    const distance = distanceMeters(previous, point);
    const elapsedSeconds = (Date.parse(point.capturedAt) - Date.parse(previous.capturedAt)) / 1000;
    if (distance < 2) continue;
    if (elapsedSeconds <= 0 || distance / elapsedSeconds > 80) continue;
    result.push(point);
  }
  return result;
}
