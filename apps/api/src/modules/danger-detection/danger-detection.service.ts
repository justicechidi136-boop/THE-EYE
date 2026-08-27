import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { ConfigService } from "@nestjs/config";
import type { Queue } from "bullmq";
import { createHash } from "crypto";
import type { DangerSourceType } from "@the-eye/shared";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import { DANGER_DETECTION_JOB_NAME, buildDangerDetectionJobId } from "../../common/queue/queue-jobs";
import { DANGER_DETECTION_QUEUE_NAME } from "../../common/queue/queue-names";
import { safeQueueAdd } from "../../common/queue/safe-queue-add";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { DANGER_CLASSIFIER, type DangerClassifier } from "./danger-classifier.interface";
import { resolveDangerDetectionConfig } from "./danger-detection.config";
import { DangerSourceLoader } from "./danger-source.loader";
import { RiskDecisionEngine } from "./risk-decision.engine";
import { dangerRecipientEligibility } from "../danger-trigger/danger-trigger.policy";

export type DangerDetectionJobPayload = { sourceType: DangerSourceType; sourceId: string; idempotencyKey: string };

@Injectable()
export class DangerDetectionService {
  private readonly logger = new Logger(DangerDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sourceLoader: DangerSourceLoader,
    private readonly riskEngine: RiskDecisionEngine,
    private readonly audit: AuditService,
    @Inject(DANGER_CLASSIFIER) private readonly classifier: DangerClassifier,
    @Optional() @InjectQueue(DANGER_DETECTION_QUEUE_NAME) private readonly queue?: Queue,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async enqueueSource(sourceType: DangerSourceType, sourceId: string) {
    const runtime = resolveDangerDetectionConfig(this.config);
    if (!runtime.enabled) return { status: "disabled" as const };
    if (!shouldRegisterBullMq() || !this.queue) {
      this.logger.warn(`Danger detection queue unavailable for ${sourceType}:${sourceId}`);
      return { status: "queue_unavailable" as const };
    }
    const idempotencyKey = buildDangerDetectionJobId(sourceType, sourceId);
    if (await this.queue.getJob(idempotencyKey)) return { status: "duplicate" as const };
    await safeQueueAdd(
      this.queue,
      DANGER_DETECTION_JOB_NAME,
      { sourceType, sourceId, idempotencyKey },
      { jobId: idempotencyKey, attempts: 4, backoff: { type: "exponential", delay: 15_000 }, removeOnComplete: 500, removeOnFail: 1000 },
      { sourceType, sourceId },
    );
    return { status: "queued" as const };
  }

  async process(payload: DangerDetectionJobPayload) {
    const runtime = resolveDangerDetectionConfig(this.config);
    if (!runtime.enabled) return { status: "disabled" as const };
    const source = await this.sourceLoader.load(payload.sourceType, payload.sourceId);
    if (!source) return { status: "ineligible_or_missing" as const };
    const normalizedText = source.text.normalize("NFKC").replace(/\s+/g, " ").trim();
    const contentHash = createHash("sha256").update(normalizedText).digest("hex");
    const prisma = this.prisma as any;
    const existing = await prisma.dangerDetectionAssessment.findUnique({
      where: { sourceType_sourceId_contentHash: { sourceType: source.sourceType, sourceId: source.sourceId, contentHash } },
    });
    if (existing && existing.state !== "FAILED") return { status: "duplicate" as const, assessmentId: existing.id };

    try {
      const classification = await this.classifier.classify({
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        text: normalizedText,
        sourceLocale: source.sourceLocale,
        occurredAt: source.occurredAt,
        userDeclaredDangerAlertCode: source.userDeclaredDangerAlertCode,
      });
      const since = new Date((source.occurredAt ?? new Date()).getTime() - runtime.correlationWindowMinutes * 60_000);
      const candidates = await prisma.dangerDetectionAssessment.findMany({
        where: {
          category: classification.category,
          immediateThreat: true,
          activeIncident: true,
          createdAt: { gte: since },
          state: { in: ["DETECTED", "POTENTIAL", "VERIFYING", "CONFIRMED"] },
        },
        select: { sourceId: true, latitude: true, longitude: true, incidentId: true, metadata: true },
        take: 50,
      });
      const decision = this.riskEngine.decide({
        classification,
        sourceId: source.sourceId,
        incidentId: source.incidentId,
        latitude: source.latitude,
        longitude: source.longitude,
        candidates: candidates.map((row: any) => ({
          sourceId: row.sourceId,
          latitude: row.latitude == null ? undefined : Number(row.latitude),
          longitude: row.longitude == null ? undefined : Number(row.longitude),
          incidentId: row.incidentId ?? undefined,
          semanticTags: Array.isArray(row.metadata?.semanticTags) ? row.metadata.semanticTags : [],
        })),
        confidenceThreshold: runtime.confidenceThreshold,
        correlationRadiusMeters: runtime.correlationRadiusMeters,
        minimumCorrelatedSources: runtime.minimumCorrelatedSources,
      });
      const assessment = await prisma.dangerDetectionAssessment.upsert({
        where: { sourceType_sourceId_contentHash: { sourceType: source.sourceType, sourceId: source.sourceId, contentHash } },
        update: this.assessmentData(source, classification, decision, contentHash),
        create: this.assessmentData(source, classification, decision, contentHash),
      });
      await this.audit.record({
        actorType: "system",
        action: "danger_detection.assessed",
        entityType: "danger_detection_assessments",
        entityId: assessment.id,
        afterState: { state: assessment.state, dangerLevel: assessment.dangerLevel, category: assessment.category, resultingAction: assessment.resultingAction },
        metadata: { sourceType: source.sourceType, sourceId: source.sourceId, classifierVersion: classification.version },
      });
      await this.correlateDangerEventSignal({ assessment, source, classification });
      return { status: "completed" as const, assessmentId: assessment.id, state: assessment.state };
    } catch (error) {
      const errorCode = error instanceof Error
        ? (error.name && error.name !== "Error" ? error.name : error.message)
        : "DANGER_CLASSIFICATION_FAILED";
      await prisma.dangerDetectionAssessment.upsert({
        where: { sourceType_sourceId_contentHash: { sourceType: source.sourceType, sourceId: source.sourceId, contentHash } },
        update: { state: "FAILED", errorCode, resultingAction: "NONE" },
        create: {
          sourceType: source.sourceType, sourceId: source.sourceId, contentHash, incidentId: source.incidentId,
          speechArtifactId: source.speechArtifactId, classifierProvider: runtime.provider, classifierModel: runtime.model,
          dangerLevel: "LOW", category: "OTHER_IMMEDIATE_LIFE_THREAT", immediateThreat: false, activeIncident: false,
          confidence: 0, requiresVerification: true, locationUsable: false, state: "FAILED", resultingAction: "NONE", errorCode,
          metadata: { processingFailed: true },
        },
      });
      throw error;
    }
  }

  async listForReview(limit = 50) {
    return (this.prisma as any).dangerDetectionAssessment.findMany({
      where: { state: { in: ["POTENTIAL", "VERIFYING", "FAILED"] } },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100),
      select: {
        id: true, sourceType: true, sourceId: true, incidentId: true, dangerZoneId: true, dangerLevel: true,
        category: true, immediateThreat: true, activeIncident: true, confidence: true, requiresVerification: true,
        locationUsable: true, latitude: true, longitude: true, occurredAt: true, state: true, correlatedSourceCount: true,
        resultingAction: true, errorCode: true, createdAt: true, updatedAt: true,
      },
    });
  }

  private assessmentData(source: any, classification: any, decision: any, contentHash: string) {
    const locationUsable = source.latitude !== undefined && source.longitude !== undefined;
    return {
      sourceType: source.sourceType, sourceId: source.sourceId, contentHash, incidentId: source.incidentId,
      speechArtifactId: source.speechArtifactId, sourceLocale: source.sourceLocale,
      classifierProvider: classification.provider, classifierModel: classification.model, classifierVersion: classification.version,
      dangerLevel: classification.dangerLevel, category: classification.category,
      immediateThreat: classification.immediateThreat, activeIncident: classification.activeIncident,
      confidence: classification.confidence, requiresVerification: classification.requiresVerification,
      locationUsable, latitude: locationUsable ? source.latitude : undefined, longitude: locationUsable ? source.longitude : undefined,
      occurredAt: source.occurredAt, state: decision.state, clusterKey: decision.clusterKey,
      correlatedSourceCount: decision.correlatedSourceCount, resultingAction: decision.resultingAction, errorCode: null,
      metadata: {
        semanticTags: classification.semanticTags ?? [],
        contextSuppression: classification.contextSuppression ?? null,
        userDeclaredDangerAlertCode: source.userDeclaredDangerAlertCode ?? null,
        classifierCategory: classification.category,
        safetyCopy: "Observe -> Report -> Stay Safe",
      },
    };
  }

  private async correlateDangerEventSignal(input: {
    assessment: any;
    source: any;
    classification: any;
  }) {
    const { assessment, source, classification } = input;
    if (!classification.immediateThreat || !classification.activeIncident) return;
    const prisma = this.prisma as any;
    if (!prisma.dangerEvent || !prisma.dangerEventSignal) return;

    let event = source.incidentId
      ? await prisma.dangerEvent.findFirst({
          where: {
            state: { in: ["POTENTIAL", "ACTIVE", "VERIFIED"] },
            OR: [
              { incidentId: source.incidentId },
              { signals: { some: { incidentId: source.incidentId } } },
            ],
          },
          orderBy: { createdAt: "desc" },
        })
      : null;
    if (!event && source.latitude != null && source.longitude != null) {
      const candidates = await prisma.dangerEvent.findMany({
        where: {
          state: { in: ["POTENTIAL", "ACTIVE", "VERIFIED"] },
          createdAt: { gte: new Date(Date.now() - 20 * 60_000) },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      event = candidates.find((candidate: any) =>
        dangerRecipientEligibility({
          dangerLatitude: Number(candidate.latitude),
          dangerLongitude: Number(candidate.longitude),
          recipientLatitude: Number(source.latitude),
          recipientLongitude: Number(source.longitude),
          recipientLocationAt: source.occurredAt ?? new Date(),
          radiusMeters: 750,
        }).eligible,
      );
    }
    if (!event) return;

    await prisma.dangerEventSignal.upsert({
      where: {
        sourceType_sourceId: {
          sourceType: "AI_SIGNAL",
          sourceId: assessment.id,
        },
      },
      update: {
        dangerEventId: event.id,
        category: classification.category,
        severity: classification.dangerLevel,
        metadata: {
          assessmentState: assessment.state,
          classifierVersion: classification.version,
          transcriptPersistedSeparately: true,
          userDeclaredDangerAlertCode: source.userDeclaredDangerAlertCode ?? null,
          classifierCategory: classification.category,
        },
      },
      create: {
        dangerEventId: event.id,
        sourceType: "AI_SIGNAL",
        sourceId: assessment.id,
        incidentId: source.incidentId,
        category: classification.category,
        severity: classification.dangerLevel,
        latitude: source.latitude,
        longitude: source.longitude,
        occurredAt: source.occurredAt ?? new Date(),
        metadata: {
          assessmentState: assessment.state,
          classifierVersion: classification.version,
          transcriptPersistedSeparately: true,
          userDeclaredDangerAlertCode: source.userDeclaredDangerAlertCode ?? null,
          classifierCategory: classification.category,
        },
      },
    });
  }
}
