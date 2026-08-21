import type { DangerClassification, DangerSourceType } from "@the-eye/shared";
import { isDangerClassification } from "@the-eye/shared";
import { buildDangerDetectionJobId } from "../../../common/queue/queue-jobs";
import type { DangerClassifier } from "../danger-classifier.interface";
import { DangerDetectionService } from "../danger-detection.service";
import { DangerSourceLoader } from "../danger-source.loader";
import { OpenAiDangerClassifier } from "../openai-danger-classifier";
import { RiskDecisionEngine } from "../risk-decision.engine";

const activeCritical: DangerClassification = {
  dangerLevel: "CRITICAL",
  category: "ACTIVE_SHOOTING",
  immediateThreat: true,
  activeIncident: true,
  confidence: 0.94,
  requiresVerification: true,
  semanticTags: ["firearm", "ongoing"],
  contextSuppression: null,
};

describe("danger detection risk decisions", () => {
  const engine = new RiskDecisionEngine();

  it("creates a potential review signal for a high-confidence active threat with location", () => {
    const result = engine.decide({
      classification: activeCritical,
      sourceId: "source-1",
      latitude: 6.5244,
      longitude: 3.3792,
      candidates: [],
      confidenceThreshold: 0.82,
      correlationRadiusMeters: 1500,
      minimumCorrelatedSources: 2,
    });
    expect(result.state).toBe("POTENTIAL");
    expect(result.resultingAction).toBe("POTENTIAL_EVENT_REVIEW");
  });

  it("routes a critical threat without usable location to urgent review only", () => {
    const result = engine.decide({
      classification: activeCritical,
      sourceId: "source-1",
      candidates: [],
      confidenceThreshold: 0.82,
      correlationRadiusMeters: 1500,
      minimumCorrelatedSources: 2,
    });
    expect(result.state).toBe("VERIFYING");
    expect(result.resultingAction).toBe("URGENT_REVIEW");
    expect(result.clusterKey).toBeUndefined();
  });

  it("correlates nearby independent matching reports without confirming a zone", () => {
    const result = engine.decide({
      classification: { ...activeCritical, confidence: 0.7 },
      sourceId: "source-2",
      latitude: 6.5244,
      longitude: 3.3792,
      candidates: [{ sourceId: "source-1", latitude: 6.525, longitude: 3.38 }],
      confidenceThreshold: 0.82,
      correlationRadiusMeters: 1500,
      minimumCorrelatedSources: 2,
    });
    expect(result.state).toBe("VERIFYING");
    expect(result.correlatedSourceCount).toBe(2);
    expect(result.state === "CONFIRMED").toBe(false);
  });

  for (const suppression of ["historical", "news", "fiction", "hypothetical", "quotation", "joke"] as const) {
    it(`suppresses ${suppression} context even when danger terms are present`, () => {
      const result = engine.decide({
        classification: { ...activeCritical, contextSuppression: suppression },
        sourceId: `source-${suppression}`,
        latitude: 6.5,
        longitude: 3.3,
        candidates: [],
        confidenceThreshold: 0.82,
        correlationRadiusMeters: 1500,
        minimumCorrelatedSources: 2,
      });
      expect(result.state).toBe("DETECTED");
      expect(result.resultingAction).toBe("NONE");
    });
  }

  it("does not escalate a resolved or inactive account", () => {
    const result = engine.decide({
      classification: { ...activeCritical, activeIncident: false },
      sourceId: "resolved",
      latitude: 6.5,
      longitude: 3.3,
      candidates: [],
      confidenceThreshold: 0.82,
      correlationRadiusMeters: 1500,
      minimumCorrelatedSources: 2,
    });
    expect(result.resultingAction).toBe("NONE");
  });
});

describe("danger detection multilingual contract", () => {
  for (const locale of ["en", "ha", "yo", "ig", "pcm"]) {
    it(`accepts a bounded ${locale} classification`, () => {
      expect(isDangerClassification({ ...activeCritical, detectedLocale: locale })).toBe(true);
    });
  }

  it("rejects unbounded confidence", () => {
    expect(isDangerClassification({ ...activeCritical, confidence: 1.2 })).toBe(false);
  });

  it("builds duplicate-safe queue identities", () => {
    const first = buildDangerDetectionJobId("INCIDENT", "source-1");
    expect(first).toBe(buildDangerDetectionJobId("INCIDENT", "source-1"));
    expect(first.includes(":")).toBe(false);
  });
});

describe("danger detection source scope", () => {
  it("ignores unrelated Neighborhood Watch discussion content", async () => {
    const prisma = {
      communityPost: { findUnique: jest.fn().mockResolvedValue({ id: "post-1", type: "Discussion", title: "Movie night", body: "Action film" }) },
    } as any;
    const source = await new DangerSourceLoader(prisma).load("COMMUNITY_POST", "post-1");
    expect(source).toBe(null);
  });

  it("loads approved safety posts with authorized coordinates", async () => {
    const prisma = {
      communityPost: { findUnique: jest.fn().mockResolvedValue({ id: "post-1", type: "CrimeAlert", title: "Safety report", body: "Ongoing danger", latitude: 6.5, longitude: 3.3, createdAt: new Date() }) },
    } as any;
    const source = await new DangerSourceLoader(prisma).load("COMMUNITY_POST", "post-1");
    expect(source?.latitude).toBe(6.5);
    expect(source?.longitude).toBe(3.3);
  });

  it("requires completed STT before audio is eligible", async () => {
    const prisma = {
      speechArtifact: { findUnique: jest.fn().mockResolvedValue({ status: "PROCESSING", content: null }) },
    } as any;
    const source = await new DangerSourceLoader(prisma).load("INCIDENT_AUDIO", "media-1");
    expect(source).toBe(null);
  });
});

describe("danger detection processing", () => {
  function harness(options: { existing?: any; classifier?: DangerClassifier } = {}) {
    let stored: any;
    const prisma = {
      dangerDetectionAssessment: {
        findUnique: jest.fn().mockResolvedValue(options.existing ?? null),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockImplementation(async ({ create, update }: any) => {
          stored = options.existing ? { ...options.existing, ...update } : { id: "assessment-1", ...create };
          return stored;
        }),
      },
    } as any;
    const sourceLoader = {
      load: jest.fn().mockResolvedValue({
        sourceType: "INCIDENT" as DangerSourceType,
        sourceId: "incident-1",
        incidentId: "incident-1",
        text: "Original private safety report text",
        sourceLocale: "en",
        latitude: 6.5,
        longitude: 3.3,
        occurredAt: new Date(),
      }),
    } as any;
    const classifier = options.classifier ?? {
      classify: jest.fn().mockResolvedValue({ ...activeCritical, provider: "test", model: "context-test", version: 1 }),
    };
    const audit = { record: jest.fn().mockResolvedValue({}) } as any;
    const config = {
      get: (key: string) => ({ DANGER_DETECTION_ENABLED: "true", DANGER_DETECTION_PROVIDER: "openai" })[key],
    } as any;
    const service = new DangerDetectionService(prisma, sourceLoader, new RiskDecisionEngine(), audit, classifier, undefined, config);
    return { service, prisma, classifier, audit, getStored: () => stored };
  }

  it("persists derived metadata without copying source text", async () => {
    const test = harness();
    const result = await test.service.process({ sourceType: "INCIDENT", sourceId: "incident-1", idempotencyKey: "job-1" });
    expect(result.status).toBe("completed");
    const serialized = JSON.stringify(test.getStored());
    expect(serialized.includes("Original private safety report text")).toBe(false);
    expect(serialized.includes("Observe -> Report -> Stay Safe")).toBe(true);
  });

  it("does not classify an existing completed content hash twice", async () => {
    const test = harness({ existing: { id: "assessment-old", state: "DETECTED" } });
    const result = await test.service.process({ sourceType: "INCIDENT", sourceId: "incident-1", idempotencyKey: "job-1" });
    expect(result.status).toBe("duplicate");
    expect((test.classifier.classify as any).mock.calls.length).toBe(0);
  });

  it("records a retryable failed assessment when the provider fails", async () => {
    const classifier = { classify: jest.fn().mockRejectedValue(new Error("PROVIDER_TIMEOUT")) } as any;
    const test = harness({ classifier });
    await expect(test.service.process({ sourceType: "INCIDENT", sourceId: "incident-1", idempotencyKey: "job-1" })).rejects.toThrow("PROVIDER_TIMEOUT");
    expect(test.getStored().state).toBe("FAILED");
    expect(test.getStored().errorCode).toBe("PROVIDER_TIMEOUT");
  });

  it("never sends transcript or report text to audit metadata", async () => {
    const test = harness();
    await test.service.process({ sourceType: "INCIDENT", sourceId: "incident-1", idempotencyKey: "job-1" });
    const auditPayload = (test.audit.record as any).mock.calls[0][0];
    expect(JSON.stringify(auditPayload).includes("Original private safety report text")).toBe(false);
  });

  it("does not call the network when OpenAI credentials are absent", async () => {
    const provider = new OpenAiDangerClassifier({ get: (key: string) => key === "OPENAI_API_KEY" ? "" : undefined } as any);
    await expect(provider.classify({ sourceType: "INCIDENT", sourceId: "incident-1", text: "help" })).rejects.toThrow("DANGER_CLASSIFIER_NOT_CONFIGURED");
  });
});
