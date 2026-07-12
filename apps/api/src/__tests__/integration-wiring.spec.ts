import { readFileSync } from "fs";
import { resolve } from "path";
import { createMetricsMock } from "../common/metrics/metrics.test-utils";
import { VerificationService } from "../modules/verification/verification.service";
import { ConfidenceScorerService } from "../modules/verification/confidence-scorer.service";

const repoRoot = resolve(__dirname, "../../../..");

function readRepo(relativePath: string) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("integration wiring", () => {
  it("wires incident submission to verification scoring", () => {
    const source = readRepo("apps/api/src/modules/incidents/incidents.service.ts");
    expect(source.includes("VerificationService")).toBe(true);
    expect(source.includes("verification.verifyIncident(incident.id)")).toBe(true);
  });

  it("wires high-confidence verification to auto-broadcast dispatch", () => {
    const source = readRepo("apps/api/src/modules/verification/verification.service.ts");
    expect(source.includes("BroadcastsService")).toBe(true);
    expect(source.includes("autoBroadcastVerifiedIncident")).toBe(true);
  });

  it("routes audit events through the hash-chain AuditService in integrated modules", () => {
    for (const modulePath of [
      "apps/api/src/modules/neighborhood-watch/neighborhood-watch.service.ts",
      "apps/api/src/modules/smartwatch/smartwatch.service.ts",
      "apps/api/src/modules/live-video/live-video.service.ts",
      "apps/api/src/modules/police-stations/police-stations.service.ts",
    ]) {
      const source = readRepo(modulePath);
      expect(source.includes("auditService.record")).toBe(true);
      expect(source.includes("prisma.auditLog.create")).toBe(false);
    }
  });

  it("exposes admin SSR API origin in docker compose", () => {
    const compose = readRepo("infra/docker/docker-compose.yml");
    expect(compose.includes("API_ORIGIN:")).toBe(true);
    expect(compose.includes("http://api:4000")).toBe(true);
  });

  it("aligns mobile API base URL with backend /v1 prefix", () => {
    const mobile = readRepo("apps/mobile/lib/main.dart");
    const enums = readRepo("apps/mobile/lib/contracts/the_eye_enums.dart");
    expect(mobile.includes("TheEyeApiConfig.resolveBaseUrl()")).toBe(true);
    expect(enums.includes("http://localhost:4000/v1")).toBe(true);
    expect(mobile.includes("localhost:3001")).toBe(false);
  });

  it("connects admin notifications and live video pages to API data layer", () => {
    const dataLayer = readRepo("apps/admin-web/lib/api/data.ts");
    expect(dataLayer.includes("fetchNotificationOperations")).toBe(true);
    expect(dataLayer.includes("fetchLiveVideoSessions")).toBe(true);
    expect(dataLayer.includes("/notifications")).toBe(true);
    expect(dataLayer.includes("/live-video/sessions/active")).toBe(true);
  });

  it("auto-escalates verified P1 incidents into broadcast pipeline", async () => {
    const prisma = {
      incident: {
        findUnique: jest.fn().mockResolvedValue({
          id: "incident-1",
          type: "Emergency",
          title: "Emergency",
          priority: "P1LifeThreatening",
          status: "Submitted",
          reporterId: "user-1",
          country: "Nigeria",
          state: "Lagos",
          lga: "Ikeja",
          latitude: 6.6012,
          longitude: 3.3514,
          manualLatitude: 6.6013,
          manualLongitude: 3.3515,
          metadata: { gpsAccuracyMeters: 8 },
          createdAt: new Date(),
          media: [],
          liveVideoSessions: [],
          reporter: null,
          verifications: [],
        }),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({ id: "incident-1", status: "Verified" }),
      },
      incidentVerification: { create: jest.fn().mockResolvedValue({ id: "verification-1" }) },
      incidentTimeline: { create: jest.fn().mockResolvedValue({ id: "timeline-1" }) },
      incidentMedia: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { createMany: jest.fn() },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      trustedReporter: { findUnique: jest.fn().mockResolvedValue(null) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    } as any;
    const broadcasts = { autoBroadcastVerifiedIncident: jest.fn().mockResolvedValue({ skipped: false }) } as any;
    const scorer = {
      score: jest.fn().mockReturnValue({
        confidenceScore: 92,
        status: "HighConfidence",
        shouldRequestCrowdConfirmation: false,
        shouldAutoEscalate: true,
        breakdown: {},
      }),
    } as any;
    const service = new VerificationService(prisma, scorer, broadcasts, createMetricsMock());
    await service.verifyIncident("incident-1");
    expect(broadcasts.autoBroadcastVerifiedIncident).toHaveBeenCalledWith("incident-1", 92);
  });
});
