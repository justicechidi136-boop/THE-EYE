import {
  buildDuplicateSignal,
  buildGpsValidationSignal,
  buildMediaEvidenceSignal,
  buildTrustedReporterSignal,
  isValidCoordinate,
  scoreDuplicateSignal,
  scoreGpsValidation,
  scoreMediaEvidence,
  scoreTrustedReporter,
  verificationLatencyTargetMs,
  withinVerificationTarget,
} from "../verification-signals";

describe("verification signals", () => {
  it("rejects invalid GPS coordinates", () => {
    expect(isValidCoordinate(0, 0)).toBe(false);
    expect(isValidCoordinate(91, 0)).toBe(false);
    expect(isValidCoordinate(6.6, 3.35)).toBe(true);
  });

  it("scores GPS accuracy and media alignment", () => {
    const gps = buildGpsValidationSignal(
      { latitude: 6.6012, longitude: 3.3514, metadata: { gpsAccuracyMeters: 12 } },
      [
        {
          id: "m1",
          fileHash: "hash-1",
          latitude: 6.6013,
          longitude: 3.3515,
          capturedAt: new Date(),
          uploadedAt: new Date(),
          mediaType: "Image",
        },
      ],
      12,
    );

    expect(scoreGpsValidation(gps)).toBeGreaterThanOrEqual(10);
  });

  it("scores media evidence with chain-of-custody signals", () => {
    const createdAt = new Date("2026-07-09T12:00:00.000Z");
    const media = buildMediaEvidenceSignal(
      [
        {
          id: "m1",
          fileHash: "hash-1",
          latitude: 6.6012,
          longitude: 3.3514,
          capturedAt: new Date("2026-07-09T12:05:00.000Z"),
          uploadedAt: new Date("2026-07-09T12:06:00.000Z"),
          mediaType: "Image",
          accessLogs: [{ id: "log-1" }],
        },
        {
          id: "m2",
          fileHash: "hash-2",
          latitude: 6.6011,
          longitude: 3.3513,
          capturedAt: new Date("2026-07-09T12:04:00.000Z"),
          uploadedAt: new Date("2026-07-09T12:05:00.000Z"),
          mediaType: "Video",
        },
      ],
      createdAt,
    );

    expect(media.chainOfCustodyScore).toBeGreaterThan(0);
    expect(scoreMediaEvidence(media)).toBeGreaterThanOrEqual(10);
  });

  it("weights duplicate proximity", () => {
    const close = buildDuplicateSignal([
      { id: "d1", distance_meters: 30 },
      { id: "d2", distance_meters: 80 },
    ]);
    const far = buildDuplicateSignal([{ id: "d3", distance_meters: 450 }]);

    expect(scoreDuplicateSignal(close)).toBeGreaterThan(scoreDuplicateSignal(far));
  });

  it("rewards trusted reporters with strong verification history", () => {
    const trusted = buildTrustedReporterSignal({
      trustScore: 92,
      verificationLevel: "Premium",
      reportsSubmitted: 20,
      reportsVerified: 18,
      revokedAt: null,
    });
    const revoked = buildTrustedReporterSignal({
      trustScore: 92,
      verificationLevel: "Premium",
      reportsSubmitted: 20,
      reportsVerified: 18,
      revokedAt: new Date(),
    });

    expect(scoreTrustedReporter(trusted)).toBeGreaterThan(scoreTrustedReporter(revoked));
  });

  it("defines a 5 second verification latency target", () => {
    expect(verificationLatencyTargetMs()).toBe(5000);
    expect(withinVerificationTarget(1200)).toBe(true);
    expect(withinVerificationTarget(6000)).toBe(false);
  });
});
