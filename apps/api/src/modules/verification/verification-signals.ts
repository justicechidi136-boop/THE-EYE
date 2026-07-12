export type MediaRecord = {
  id: string;
  fileHash: string;
  latitude: unknown;
  longitude: unknown;
  capturedAt: Date;
  uploadedAt: Date;
  mediaType: string;
  accessLogs?: Array<{ id: string }>;
};

export type TrustedReporterRecord = {
  trustScore: unknown;
  verificationLevel: string;
  reportsSubmitted: number;
  reportsVerified: number;
  revokedAt: Date | null;
} | null | undefined;

export type DuplicateRecord = {
  id: string;
  distance_meters: number;
  title?: string;
};

export type GpsValidationSignal = {
  accuracyMeters?: number | null;
  hasIncidentGps: boolean;
  invalidCoordinates: boolean;
  manualAdjustmentMeters?: number | null;
  mediaGpsAlignmentRatio: number;
};

export type MediaEvidenceSignal = {
  count: number;
  gpsAlignedCount: number;
  uniqueHashCount: number;
  timelyCaptureCount: number;
  typeVariety: number;
  chainOfCustodyScore: number;
  duplicateHashElsewhere: number;
};

export type DuplicateSignal = {
  count: number;
  weightedScore: number;
  closestDistanceMeters?: number | null;
};

export type TrustedReporterSignal = {
  trustScore?: number | null;
  verificationLevel?: string | null;
  verifiedRatio: number;
  revoked: boolean;
};

const INITIAL_VERIFICATION_TARGET_MS = 5000;

export function verificationLatencyTargetMs() {
  return INITIAL_VERIFICATION_TARGET_MS;
}

export function withinVerificationTarget(elapsedMs: number) {
  return elapsedMs <= INITIAL_VERIFICATION_TARGET_MS;
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isValidCoordinate(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (Math.abs(latitude) < 0.0001 && Math.abs(longitude) < 0.0001) return false;
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function buildGpsValidationSignal(
  incident: {
    latitude: unknown;
    longitude: unknown;
    manualLatitude?: unknown;
    manualLongitude?: unknown;
    metadata: unknown;
  },
  media: MediaRecord[],
  gpsAccuracyMeters?: number | null,
): GpsValidationSignal {
  const latitude = Number(incident.latitude);
  const longitude = Number(incident.longitude);
  const hasIncidentGps = isValidCoordinate(latitude, longitude);
  const invalidCoordinates = !hasIncidentGps;

  let manualAdjustmentMeters: number | undefined;
  if (
    incident.manualLatitude !== null &&
    incident.manualLatitude !== undefined &&
    incident.manualLongitude !== null &&
    incident.manualLongitude !== undefined &&
    hasIncidentGps
  ) {
    manualAdjustmentMeters = haversineMeters(
      latitude,
      longitude,
      Number(incident.manualLatitude),
      Number(incident.manualLongitude),
    );
  }

  const aligned = media.filter((item) => {
    const lat = Number(item.latitude);
    const lng = Number(item.longitude);
    if (!isValidCoordinate(lat, lng) || !hasIncidentGps) return false;
    return haversineMeters(latitude, longitude, lat, lng) <= 150;
  });

  const accuracyFromMetadata =
    gpsAccuracyMeters ??
    (incident.metadata && typeof incident.metadata === "object" && "gpsAccuracyMeters" in incident.metadata
      ? Number((incident.metadata as Record<string, unknown>).gpsAccuracyMeters)
      : undefined);

  return {
    accuracyMeters: Number.isFinite(accuracyFromMetadata) ? accuracyFromMetadata : undefined,
    hasIncidentGps,
    invalidCoordinates,
    manualAdjustmentMeters,
    mediaGpsAlignmentRatio: media.length ? aligned.length / media.length : 0,
  };
}

export function buildMediaEvidenceSignal(media: MediaRecord[], incidentCreatedAt: Date): MediaEvidenceSignal {
  const hashes = new Set<string>();
  let gpsAlignedCount = 0;
  let timelyCaptureCount = 0;
  const types = new Set<string>();
  let chainPoints = 0;

  for (const item of media) {
    if (item.fileHash) hashes.add(item.fileHash);
    types.add(item.mediaType);

    const lat = Number(item.latitude);
    const lng = Number(item.longitude);
    if (isValidCoordinate(lat, lng)) gpsAlignedCount += 1;

    const captureDeltaMinutes = Math.abs(item.capturedAt.getTime() - incidentCreatedAt.getTime()) / 60000;
    if (captureDeltaMinutes <= 30) timelyCaptureCount += 1;

    if (item.fileHash && item.uploadedAt >= item.capturedAt) chainPoints += 1;
    if (item.accessLogs?.length) chainPoints += 1;
  }

  const chainOfCustodyScore = media.length
    ? Math.min(8, Math.round((chainPoints / (media.length * 2)) * 8))
    : 0;

  return {
    count: media.length,
    gpsAlignedCount,
    uniqueHashCount: hashes.size,
    timelyCaptureCount,
    typeVariety: types.size,
    chainOfCustodyScore,
    duplicateHashElsewhere: 0,
  };
}

export function buildDuplicateSignal(duplicates: DuplicateRecord[]): DuplicateSignal {
  if (!duplicates.length) {
    return { count: 0, weightedScore: 0, closestDistanceMeters: null };
  }

  let weightedScore = 0;
  for (const duplicate of duplicates) {
    const distance = Number(duplicate.distance_meters);
    if (distance <= 50) weightedScore += 4;
    else if (distance <= 150) weightedScore += 3;
    else if (distance <= 300) weightedScore += 2;
    else weightedScore += 1;
  }

  return {
    count: duplicates.length,
    weightedScore: Math.min(weightedScore, 12),
    closestDistanceMeters: Number(duplicates[0]?.distance_meters ?? null),
  };
}

export function buildTrustedReporterSignal(trustedReporter: TrustedReporterRecord): TrustedReporterSignal {
  if (!trustedReporter || trustedReporter.revokedAt) {
    return { trustScore: 0, verificationLevel: null, verifiedRatio: 0, revoked: true };
  }

  const submitted = Math.max(trustedReporter.reportsSubmitted, 0);
  const verified = Math.max(trustedReporter.reportsVerified, 0);
  const verifiedRatio = submitted > 0 ? verified / submitted : 0.5;

  return {
    trustScore: Number(trustedReporter.trustScore),
    verificationLevel: trustedReporter.verificationLevel,
    verifiedRatio,
    revoked: false,
  };
}

export function scoreMediaEvidence(signal: MediaEvidenceSignal) {
  if (signal.count <= 0) return 0;

  let score = 0;
  if (signal.count === 1) score = 4;
  else if (signal.count === 2) score = 6;
  else score = 8;

  if (signal.gpsAlignedCount > 0) score += Math.min(3, signal.gpsAlignedCount);
  if (signal.timelyCaptureCount > 0) score += 2;
  if (signal.typeVariety >= 2) score += 1;
  if (signal.uniqueHashCount === signal.count) score += 1;
  score += Math.min(2, signal.chainOfCustodyScore / 4);
  score -= Math.min(4, signal.duplicateHashElsewhere * 2);

  return Math.max(0, Math.min(12, Math.round(score)));
}

export function scoreGpsValidation(signal: GpsValidationSignal) {
  if (signal.invalidCoordinates) return 0;

  let score = 4;
  const accuracy = signal.accuracyMeters;
  if (accuracy === undefined || accuracy === null) score += 0;
  else if (accuracy <= 15) score += 8;
  else if (accuracy <= 50) score += 6;
  else if (accuracy <= 100) score += 4;
  else if (accuracy <= 250) score += 2;

  if (signal.mediaGpsAlignmentRatio >= 0.75) score += 2;
  else if (signal.mediaGpsAlignmentRatio >= 0.5) score += 1;

  if (signal.manualAdjustmentMeters !== undefined && signal.manualAdjustmentMeters > 500) score -= 2;

  return Math.max(0, Math.min(12, Math.round(score)));
}

export function scoreDuplicateSignal(signal: DuplicateSignal) {
  if (signal.count <= 0) return 0;
  if (signal.weightedScore >= 10) return 10;
  if (signal.weightedScore >= 7) return 8;
  if (signal.weightedScore >= 4) return 5;
  return 3;
}

export function scoreTrustedReporter(signal: TrustedReporterSignal) {
  if (signal.revoked) return 0;
  const base = signal.trustScore === undefined || signal.trustScore === null ? 5 : (signal.trustScore / 100) * 10;
  const ratioBonus = signal.verifiedRatio >= 0.8 ? 3 : signal.verifiedRatio >= 0.5 ? 1 : 0;
  const levelBonus = signal.verificationLevel === "Premium" ? 2 : signal.verificationLevel === "Verified" ? 1 : 0;
  return Math.max(0, Math.min(14, Math.round(base + ratioBonus + levelBonus)));
}
