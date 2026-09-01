import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AdminRoleName, DangerAlertCode, IncidentPriority, IncidentStatus, IncidentType } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { createStorageDownloadUrl } from "../../common/storage/s3-presign";
import {
  buildDangerZoneAlertPayload,
  dangerAlertPayloadToFcmData,
} from "../danger-zones/danger-alert-payload";
import { JurisdictionResolutionService } from "../incidents/jurisdiction-resolution.service";
import { LiveKitTokenService } from "../live-video/livekit-token.service";
import { LiveVideoService } from "../live-video/live-video.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  type ActivateDangerTriggerDto,
  type CancelDangerTriggerDto,
  type EvaluateDangerLocationDto,
  type StartDangerTriggerDto,
  validateEvaluateDangerLocationDto,
  validateStartDangerTriggerDto,
} from "./dto/danger-trigger.dto";
import {
  classifyDangerAreaRisk,
  DANGER_AREA_RISK_RADIUS_METERS,
  DANGER_AREA_RISK_WINDOW_DAYS,
  DANGER_ACTIVE_EVENT_MAX_AGE_MS,
  DANGER_RECIPIENT_LOCATION_FRESHNESS_MS,
  dangerClusterKey,
  dangerRecipientEligibility,
  isPlausibleDangerLocationTransition,
  OWNER_APPROVED_MAX_DANGER_RADIUS_METERS,
  resolveDangerRadius,
} from "./danger-trigger.policy";

type NearbyGeoState = {
  userId: string;
  deviceId: string | null;
  latitude: number;
  longitude: number;
  lastEvaluatedAt: Date;
  accuracyMeters?: number | null;
};

const DANGER_ALERT_RELEVANCE_MS = 30 * 60 * 1000;
const DANGER_EVENT_DEFAULT_ACTIVE_MS = DANGER_ACTIVE_EVENT_MAX_AGE_MS;

export type TrustedDangerLocation = {
  recipientType: "mobile" | "watch" | "field";
  recipientUserId: string;
  deviceId?: string | null;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: Date;
  previousLatitude?: number | null;
  previousLongitude?: number | null;
  previousCapturedAt?: Date | null;
  persistMobileState?: boolean;
};

function dangerLabel(code: string) {
  switch (code) {
    case DangerAlertCode.ARMED_ROBBERY_NEARBY: return "Active Robbery";
    case DangerAlertCode.KIDNAPPING_NEARBY: return "Kidnapping";
    case DangerAlertCode.FIRE_NEARBY: return "Fire";
    case DangerAlertCode.FLOOD_NEARBY: return "Flood Emergency";
    case DangerAlertCode.BUILDING_COLLAPSE_NEARBY: return "Building Collapse";
    case DangerAlertCode.ROAD_DANGER_NEARBY: return "Road Hazard";
    case DangerAlertCode.ACTIVE_SHOOTER_NEARBY: return "Shooting or Gunfire";
    case DangerAlertCode.VIOLENT_ATTACK_NEARBY: return "Violent Attack";
    case DangerAlertCode.COMMUNAL_VIOLENCE_NEARBY: return "Communal Violence";
    case DangerAlertCode.BANDIT_ATTACK_NEARBY: return "Bandit or Unknown Gunmen Attack";
    case DangerAlertCode.CULT_CLASH_NEARBY: return "Cult Clash";
    case DangerAlertCode.COMMUNITY_CRISIS_NEARBY: return "Community Crisis";
    case DangerAlertCode.KILLING_NEARBY: return "Killing";
    case DangerAlertCode.TERRORIST_THREAT_NEARBY: return "Terrorist Threat";
    case DangerAlertCode.GAS_LEAK_NEARBY: return "Gas Leak";
    case DangerAlertCode.HAZARDOUS_AREA_NEARBY: return "Hazardous Area";
    case DangerAlertCode.CIVIL_DISTURBANCE_NEARBY: return "Riot";
    case DangerAlertCode.POLICE_ADVISORY_NEARBY: return "Police Safety Advisory";
    case DangerAlertCode.MISSING_CHILD_NEARBY: return "Missing Child";
    case DangerAlertCode.EVACUATION_NEARBY: return "Evacuation";
    case DangerAlertCode.PROXIMITY_INCREASE: return "Danger Moved Closer";
    default: return "Other Immediate Danger";
  }
}

@Injectable()
export class DangerTriggerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jurisdictionResolution: JurisdictionResolutionService,
    private readonly liveVideo: LiveVideoService,
    private readonly livekitTokens: LiveKitTokenService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async prepareLiveVoice(
    dto: StartDangerTriggerDto,
    actor: JwtPayload,
    trace: { requestId?: string; clientTraceId?: string } = {},
  ) {
    this.assertCitizen(actor);
    validateStartDangerTriggerDto(dto);
    const dangerAlertCode = dto.dangerAlertCode ?? DangerAlertCode.GENERAL_ENTRY;
    const userDeclaredDangerAlertCode = dto.dangerAlertCode ?? null;
    const dangerAlertCodeSource = dto.dangerAlertCode ? "USER_SELECTED" : "LEGACY_FALLBACK";
    const prisma = this.prisma as any;
    const existingSignal = await prisma.dangerEventSignal.findUnique({
      where: { sourceType_sourceId: { sourceType: "LIVE_VOICE", sourceId: dto.clientTriggerId } },
      include: { dangerEvent: true },
    });
    if (existingSignal?.dangerEvent?.initiatorUserId === actor.sub) {
      return this.resumePreparedEvent(
        existingSignal.dangerEvent,
        actor,
        dto,
        trace,
        existingSignal.incidentId,
      );
    }
    if (existingSignal?.initiatorUserId === actor.sub) {
      return this.resumePreparedEvent(
        existingSignal.dangerEvent,
        actor,
        dto,
        trace,
        existingSignal.incidentId,
      );
    }

    const jurisdiction = await this.jurisdictionResolution.resolve({
      latitude: dto.latitude,
      longitude: dto.longitude,
      actor,
    });
    const locationCapturedAt = new Date(dto.locationCapturedAt);
    const locationAgeSeconds = Math.max(0, Math.round((Date.now() - locationCapturedAt.getTime()) / 1000));
    const locationUncertain = locationAgeSeconds > 120 || Number(dto.accuracyMeters ?? 0) > 150;
    const spokenLocationName = this.spokenLocationName(dto.spokenLocationName);
    const incident = await prisma.incident.create({
      data: {
        reporterId: actor.sub,
        jurisdictionId: jurisdiction.id,
        type: IncidentType.Emergency,
        status: IncidentStatus.Submitted,
        priority: IncidentPriority.P1LifeThreatening,
        title: dto.qaTest ? "QA Danger Trigger Alert" : "Danger Trigger Alert",
        description: "Citizen intentionally started a live voice danger broadcast.",
        address: dto.areaName?.trim() || null,
        country: jurisdiction.country,
        state: jurisdiction.state,
        lga: jurisdiction.lga,
        latitude: dto.latitude,
        longitude: dto.longitude,
        clientSubmissionId: dto.clientTriggerId,
        occurredAt: new Date(),
        metadata: {
          source: "danger_trigger_live_voice",
          qaTest: dto.qaTest === true,
          locationSource: dto.locationSource,
          locationCapturedAt: dto.locationCapturedAt,
          accuracyMeters: dto.accuracyMeters ?? null,
          locationAgeSeconds,
          locationUncertain,
          aiDangerAnalysisIndependent: true,
          ambientMicrophoneSurveillance: false,
          dangerAlertCode,
          userDeclaredDangerAlertCode,
          dangerAlertCodeSource,
          spokenLocationName,
        },
      },
    });

    const live = await this.liveVideo.startIncidentLiveVideo(
      incident.id,
      {
        lowBandwidthMode: dto.lowBandwidthMode ?? true,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracyMeters,
        capturedAt: dto.locationCapturedAt,
        sourceDeviceId: "citizen-danger-trigger",
      },
      actor,
      trace,
    );
    const liveSession = (live as any).data;
    const radiusMeters = OWNER_APPROVED_MAX_DANGER_RADIUS_METERS;
    const clusterKey = dangerClusterKey(dto.latitude, dto.longitude);
    const correlated = await this.findCorrelatedEvent(
      dto.latitude,
      dto.longitude,
      dangerAlertCode,
    );
    const event = correlated
      ? await prisma.dangerEvent.update({
          where: { id: correlated.id },
          data: {
            liveVoiceSessionId: liveSession.id,
            severity: "CRITICAL",
            metadata: {
              ...(correlated.metadata ?? {}),
              latestLiveVoiceSessionId: liveSession.id,
              correlatedTriggerCount: Number(correlated.metadata?.correlatedTriggerCount ?? 1) + 1,
              dangerAlertCode,
              spokenLocationName,
            },
          },
        })
      : await prisma.dangerEvent.create({
          data: {
            incidentId: incident.id,
            initiatorUserId: actor.sub,
            sourceType: "LIVE_VOICE",
            state: "POTENTIAL",
            severity: "CRITICAL",
            latitude: dto.latitude,
            longitude: dto.longitude,
            accuracyMeters: dto.accuracyMeters,
            locationSource: dto.locationSource,
            locationCapturedAt,
            areaName: dto.areaName?.trim() || [jurisdiction.lga, jurisdiction.state].filter(Boolean).join(", "),
            effectiveRadiusMeters: radiusMeters,
            maxRadiusMeters: 4_000,
            liveVoiceSessionId: liveSession.id,
            clusterKey,
            metadata: {
              qaTest: dto.qaTest === true,
              locationUncertain,
              preparedAt: new Date().toISOString(),
              liveConnectionConfirmed: false,
              aiDangerAnalysisIndependent: true,
              ambientMicrophoneSurveillance: false,
              dangerAlertCode,
              userDeclaredDangerAlertCode,
              dangerAlertCodeSource,
              spokenLocationName,
            },
          },
        });

    await prisma.dangerEventSignal.create({
      data: {
        dangerEventId: event.id,
        sourceType: "LIVE_VOICE",
        sourceId: dto.clientTriggerId,
        incidentId: incident.id,
        liveVoiceSessionId: liveSession.id,
        initiatorUserId: actor.sub,
        severity: "CRITICAL",
        latitude: dto.latitude,
        longitude: dto.longitude,
        metadata: {
          locationUncertain,
          qaTest: dto.qaTest === true,
          dangerAlertCode,
          userDeclaredDangerAlertCode,
          dangerAlertCodeSource,
          spokenLocationName,
        },
      },
    });
    await prisma.liveVideoSession.update({
      where: { id: liveSession.id },
      data: {
        metadata: {
          ...(liveSession.metadata ?? {}),
          mediaMode: "audio_only",
          dangerEventId: event.id,
          explicitUserActivation: true,
          ambientListening: false,
        },
      },
    });
    await this.audit.record({
      actorType: "user",
      actorUserId: actor.sub,
      action: "danger_trigger.prepared",
      entityType: "danger_events",
      entityId: event.id,
      metadata: { incidentId: incident.id, liveVoiceSessionId: liveSession.id, locationUncertain },
    });
    return this.startResponse(event, live, incident.id);
  }

  async activate(eventId: string, dto: ActivateDangerTriggerDto, actor: JwtPayload) {
    this.assertCitizen(actor);
    const prisma = this.prisma as any;
    const event = await prisma.dangerEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException("Danger event not found");
    const signal = await prisma.dangerEventSignal.findFirst({
      where: { dangerEventId: eventId, liveVoiceSessionId: dto.liveVoiceSessionId, initiatorUserId: actor.sub },
    });
    if (!signal) throw new ForbiddenException("Only the live voice initiator can activate this trigger");
    const session = await prisma.liveVideoSession.findUnique({ where: { id: dto.liveVoiceSessionId } });
    if (!session || session.status !== "Active") throw new BadRequestException("Live voice session is not active");
    const connectedAt = new Date(dto.connectedAt);
    if (Number.isNaN(connectedAt.getTime()) || Math.abs(Date.now() - connectedAt.getTime()) > 5 * 60_000) {
      throw new BadRequestException("connectedAt is invalid");
    }
    const metadata = (event.metadata ?? {}) as Record<string, unknown>;
    const activated = await prisma.dangerEvent.update({
      where: { id: eventId },
      data: {
        state: "ACTIVE",
        liveVoiceSessionId: dto.liveVoiceSessionId,
        metadata: {
          ...metadata,
          liveConnectionConfirmed: true,
          activatedAt: connectedAt.toISOString(),
          latestLiveVoiceSessionId: dto.liveVoiceSessionId,
          alertRevision: Math.max(1, Number(metadata.alertRevision ?? 1)),
          expiresAt:
            metadata.expiresAt ??
            new Date(connectedAt.getTime() + DANGER_EVENT_DEFAULT_ACTIVE_MS).toISOString(),
        },
      },
    });
    const fanout = metadata.alertFanoutCompletedAt
      ? { recipients: 0, duplicate: true }
      : await this.fanout(activated);
    const initiatorWatchAlert = this.buildWatchAlert(
      activated,
      actor.sub,
      0,
      "DANGER ALERT ACTIVE",
      `Your live danger alert is active. Nearby users within ${Math.round(activated.effectiveRadiusMeters / 1000)} km are being alerted.`,
    );
    if (!metadata.alertFanoutCompletedAt) {
      await this.notifications.create({
        userId: actor.sub,
        type: "NearbyDangerWarning",
        priority: "Critical",
        channels: ["watch_push"],
        title: initiatorWatchAlert.title,
        body: initiatorWatchAlert.body,
        incidentId: activated.incidentId,
        metadata: {
          category: "DANGER_ALERT",
          dangerEventId: activated.id,
          preciseReporterLocationExposed: false,
          liveAvailable: true,
          watchLiveAudioSupported: false,
          dangerAlert: initiatorWatchAlert.dangerAlert,
        },
      });
    }
    const adminNotificationCount = metadata.alertFanoutCompletedAt
      ? 0
      : await this.notifyScopedAdmins(activated);
    if (!metadata.alertFanoutCompletedAt) {
      await prisma.dangerEvent.update({
        where: { id: eventId },
        data: { metadata: { ...activated.metadata, alertFanoutCompletedAt: new Date().toISOString() } },
      });
    }
    await this.audit.record({
      actorType: "user",
      actorUserId: actor.sub,
      action: "danger_trigger.activated",
      entityType: "danger_events",
      entityId: eventId,
      metadata: {
        liveVoiceSessionId: dto.liveVoiceSessionId,
        recipientCount: fanout.recipients,
        adminNotificationCount,
      },
    });
    return {
      data: this.publicEvent(activated),
      fanout,
      initiatorWatchAlertQueued: !metadata.alertFanoutCompletedAt,
      watchRelay: initiatorWatchAlert.relayData,
      adminNotificationCount,
    };
  }

  async areaRisk(latitude: number, longitude: number, actor: JwtPayload) {
    this.assertCitizen(actor);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new BadRequestException("latitude must be between -90 and 90");
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new BadRequestException("longitude must be between -180 and 180");
    }
    if (latitude === 0 && longitude === 0) {
      throw new BadRequestException("A valid location is required");
    }

    const since = new Date(Date.now() - DANGER_AREA_RISK_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const latitudeDelta = DANGER_AREA_RISK_RADIUS_METERS / 111_320;
    const longitudeScale = Math.max(0.1, Math.cos((latitude * Math.PI) / 180));
    const longitudeDelta = DANGER_AREA_RISK_RADIUS_METERS / (111_320 * longitudeScale);
    const candidates = await (this.prisma as any).dangerEvent.findMany({
      where: {
        state: { in: ["ACTIVE", "VERIFIED", "RESOLVED"] },
        createdAt: { gte: since },
        latitude: { gte: latitude - latitudeDelta, lte: latitude + latitudeDelta },
        longitude: { gte: longitude - longitudeDelta, lte: longitude + longitudeDelta },
      },
      select: { latitude: true, longitude: true, areaName: true, metadata: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const nearby = candidates
      .filter((event: any) => event.metadata?.qaTest !== true)
      .map((event: any) => ({
        event,
        distanceMeters: dangerRecipientEligibility({
          dangerLatitude: Number(event.latitude),
          dangerLongitude: Number(event.longitude),
          recipientLatitude: latitude,
          recipientLongitude: longitude,
          recipientLocationAt: new Date(),
          radiusMeters: DANGER_AREA_RISK_RADIUS_METERS,
        }).distanceMeters,
      }))
      .filter((entry: any) => entry.distanceMeters <= DANGER_AREA_RISK_RADIUS_METERS)
      .sort((a: any, b: any) => a.distanceMeters - b.distanceMeters);

    return {
      data: {
        level: classifyDangerAreaRisk(nearby.length),
        eventCount: nearby.length,
        windowDays: DANGER_AREA_RISK_WINDOW_DAYS,
        radiusMeters: DANGER_AREA_RISK_RADIUS_METERS,
        approximateArea: nearby[0]?.event?.areaName ?? null,
        evaluatedAt: new Date().toISOString(),
      },
    };
  }

  async evaluateCitizenLocation(dto: EvaluateDangerLocationDto, actor: JwtPayload) {
    this.assertCitizen(actor);
    validateEvaluateDangerLocationDto(dto);
    const existing = await (this.prisma as any).deviceGeoState.findFirst({
      where: { userId: actor.sub, deviceId: null },
      orderBy: { lastEvaluatedAt: "desc" },
    });
    return this.evaluateTrustedLocation({
      recipientType: "mobile",
      recipientUserId: actor.sub,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracyMeters: dto.accuracyMeters,
      capturedAt: new Date(dto.capturedAt),
      previousLatitude: existing?.latitude == null ? null : Number(existing.latitude),
      previousLongitude: existing?.longitude == null ? null : Number(existing.longitude),
      previousCapturedAt: existing?.lastEvaluatedAt ?? null,
      persistMobileState: true,
    });
  }

  async evaluateTrustedLocation(input: TrustedDangerLocation) {
    const now = new Date();
    const ageMs = now.getTime() - input.capturedAt.getTime();
    if (
      ageMs < -30_000 ||
      ageMs > DANGER_RECIPIENT_LOCATION_FRESHNESS_MS ||
      !Number.isFinite(input.accuracyMeters) ||
      input.accuracyMeters < 0 ||
      input.accuracyMeters > 150
    ) {
      return { evaluated: false, reason: "untrusted_location", alerts: [] };
    }
    if (!isPlausibleDangerLocationTransition(input)) {
      return { evaluated: false, reason: "impossible_location_jump", alerts: [] };
    }

    if (input.persistMobileState) {
      await this.persistMobileGeoState(input);
    }

    const radius = OWNER_APPROVED_MAX_DANGER_RADIUS_METERS;
    const latitudeDelta = radius / 111_320;
    const longitudeScale = Math.max(0.1, Math.cos((input.latitude * Math.PI) / 180));
    const longitudeDelta = radius / (111_320 * longitudeScale);
    const candidates = await (this.prisma as any).dangerEvent.findMany({
      where: {
        state: "ACTIVE",
        createdAt: { gte: new Date(now.getTime() - DANGER_ACTIVE_EVENT_MAX_AGE_MS) },
        latitude: { gte: input.latitude - latitudeDelta, lte: input.latitude + latitudeDelta },
        longitude: { gte: input.longitude - longitudeDelta, lte: input.longitude + longitudeDelta },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const alerts = [] as Array<Record<string, unknown>>;
    for (const event of candidates) {
      if (event.initiatorUserId === input.recipientUserId) continue;
      if (!this.eventIsCurrentlyEffective(event, now)) continue;
      const eligibility = dangerRecipientEligibility({
        dangerLatitude: Number(event.latitude),
        dangerLongitude: Number(event.longitude),
        recipientLatitude: input.latitude,
        recipientLongitude: input.longitude,
        recipientLocationAt: input.capturedAt,
        recipientAccuracyMeters: input.accuracyMeters,
        radiusMeters: Math.min(Number(event.effectiveRadiusMeters), radius),
        now,
      });
      if (!eligibility.eligible) continue;
      const delivered = await this.deliverDangerEvent(event, {
        recipientType: input.recipientType,
        recipientUserId: input.recipientUserId,
        deviceId: input.deviceId,
        distanceMeters: eligibility.distanceMeters,
        locationCapturedAt: input.capturedAt,
        reason: "ACTIVE_ZONE_ENTRY",
      });
      alerts.push(delivered);
    }
    return { evaluated: true, alerts };
  }

  async originalVoice(eventId: string, actor: JwtPayload) {
    const event = await (this.prisma as any).dangerEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException("Danger event not found");
    await this.assertCanAccess(event, actor);
    const media = await this.findOriginalVoice(event);
    if (!media) throw new NotFoundException("Original voice is not available for this alert");
    const signed = await createStorageDownloadUrl(media.objectKey, 300);
    await (this.prisma as any).incidentMediaAccessLog.create({
      data: {
        mediaId: media.id,
        accessorId: actor.typ === "user" ? actor.sub : undefined,
        adminUserId: actor.typ === "admin" || actor.typ === "field" ? actor.sub : undefined,
        action: "view",
        reason: "Authorized danger alert original voice playback",
      },
    });
    return {
      data: {
        label: "Original voice",
        signedUrl: signed.url,
        expiresInSeconds: signed.expiresInSeconds,
      },
    };
  }

  async stopLiveVoice(eventId: string, actor: JwtPayload) {
    this.assertCitizen(actor);
    const prisma = this.prisma as any;
    const event = await prisma.dangerEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException("Danger event not found");
    const signal = await prisma.dangerEventSignal.findFirst({
      where: { dangerEventId: eventId, initiatorUserId: actor.sub, sourceType: "LIVE_VOICE" },
      orderBy: { occurredAt: "desc" },
    });
    if (!signal) throw new ForbiddenException("Only a trigger owner can end their live voice");
    if (signal.liveVoiceSessionId) {
      await this.liveVideo.stopIncidentLiveVideo(signal.liveVoiceSessionId, actor);
    }
    const updated = await prisma.dangerEvent.update({
      where: { id: eventId },
      data: signal.liveVoiceSessionId === event.liveVoiceSessionId
        ? { liveVoiceEndedAt: new Date() }
        : {},
    });
    await prisma.dangerEventSignal.update({
      where: { id: signal.id },
      data: {
        metadata: {
          ...(signal.metadata ?? {}),
          liveVoiceEndedAt: new Date().toISOString(),
        },
      },
    });
    await this.audit.record({
      actorType: "user",
      actorUserId: actor.sub,
      action: "danger_trigger.voice_ended",
      entityType: "danger_events",
      entityId: eventId,
      metadata: { eventStatePreserved: updated.state },
    });
    return { data: this.publicEvent(updated) };
  }

  async cancel(eventId: string, dto: CancelDangerTriggerDto, actor: JwtPayload) {
    this.assertCitizen(actor);
    const prisma = this.prisma as any;
    const event = await prisma.dangerEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException("Danger event not found");
    const signal = await prisma.dangerEventSignal.findFirst({
      where: { dangerEventId: eventId, initiatorUserId: actor.sub, sourceType: "LIVE_VOICE" },
      orderBy: { occurredAt: "desc" },
    });
    if (!signal) throw new ForbiddenException("Only a trigger owner can cancel their trigger");
    if (signal.liveVoiceSessionId) {
      await this.liveVideo.stopIncidentLiveVideo(signal.liveVoiceSessionId, actor);
    }
    const reason = dto.reason?.trim().slice(0, 500) || "Triggered by mistake";
    await prisma.dangerEventSignal.update({
      where: { id: signal.id },
      data: {
        metadata: {
          ...(signal.metadata ?? {}),
          cancelledAt: new Date().toISOString(),
          cancellationReason: reason,
        },
      },
    });
    const signals = await prisma.dangerEventSignal.findMany({
      where: { dangerEventId: eventId },
      select: { id: true, metadata: true },
    });
    const hasOtherActiveSignal = signals.some((candidate: any) =>
      candidate.id !== signal.id && !candidate.metadata?.cancelledAt,
    );
    const updated = await prisma.dangerEvent.update({
      where: { id: eventId },
      data: hasOtherActiveSignal
        ? {
            liveVoiceEndedAt: signal.liveVoiceSessionId === event.liveVoiceSessionId
              ? new Date()
              : event.liveVoiceEndedAt,
          }
        : {
            state: "FALSE_ALARM",
            cancelledAt: new Date(),
            cancellationReason: reason,
            liveVoiceEndedAt: event.liveVoiceEndedAt ?? new Date(),
          },
    });
    await this.audit.record({
      actorType: "user",
      actorUserId: actor.sub,
      action: "danger_trigger.cancelled",
      entityType: "danger_events",
      entityId: eventId,
      metadata: { reasonRecorded: true, eventStatePreserved: hasOtherActiveSignal },
    });
    return { data: this.publicEvent(updated) };
  }

  async detail(eventId: string, actor: JwtPayload) {
    const event = await (this.prisma as any).dangerEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException("Danger event not found");
    await this.assertCanAccess(event, actor);
    const originalVoice = await this.findOriginalVoice(event);
    return {
      data: this.publicEvent(event, {
        originalVoiceAvailable: originalVoice != null,
      }),
    };
  }

  async listenerToken(eventId: string, actor: JwtPayload) {
    const prisma = this.prisma as any;
    const event = await prisma.dangerEvent.findUnique({
      where: { id: eventId },
      include: { liveVoiceSession: true },
    });
    if (!event) throw new NotFoundException("Danger event not found");
    await this.assertCanAccess(event, actor);
    if (event.state !== "ACTIVE" || !event.liveVoiceSession || event.liveVoiceEndedAt) {
      throw new BadRequestException("Live warning is not available");
    }
    this.livekitTokens.assertLiveKitConfigured({ requireWss: true });
    const identity = `${actor.typ}-${actor.sub}-danger-listener`;
    const token = this.livekitTokens.createToken({
      identity,
      name: "Authorized danger alert listener",
      roomName: event.liveVoiceSession.roomName,
      canPublish: false,
      canSubscribe: true,
    });
    return {
      data: {
        eventId,
        roomName: event.liveVoiceSession.roomName,
        participantIdentity: identity,
      },
      connection: {
        serverUrl: this.livekitTokens.clientLivekitUrl({ requireWss: true }),
        participantToken: token,
        roomName: event.liveVoiceSession.roomName,
        participantIdentity: identity,
      },
    };
  }

  private async resumePreparedEvent(
    event: any,
    actor: JwtPayload,
    dto: StartDangerTriggerDto,
    trace: any,
    signalIncidentId?: string,
  ) {
    const incidentId = signalIncidentId ?? event.incidentId;
    const live = await this.liveVideo.startIncidentLiveVideo(incidentId, {
      lowBandwidthMode: dto.lowBandwidthMode ?? true,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracyMeters,
      capturedAt: dto.locationCapturedAt,
      sourceDeviceId: "citizen-danger-trigger",
    }, actor, trace);
    return this.startResponse(event, live, incidentId);
  }

  private async findCorrelatedEvent(
    latitude: number,
    longitude: number,
    dangerAlertCode: string,
  ) {
    const since = new Date(Date.now() - 20 * 60_000);
    const candidates = await (this.prisma as any).dangerEvent.findMany({
      where: { state: { in: ["POTENTIAL", "ACTIVE", "VERIFIED"] }, createdAt: { gte: since } },
      take: 50,
      orderBy: { createdAt: "desc" },
    });
    return candidates.find(
      (candidate: any) =>
        this.normalizedDangerCode(candidate) === dangerAlertCode &&
        dangerRecipientEligibility({
          dangerLatitude: latitude,
          dangerLongitude: longitude,
          recipientLatitude: Number(candidate.latitude),
          recipientLongitude: Number(candidate.longitude),
          recipientLocationAt: new Date(),
          radiusMeters: 750,
        }).eligible,
    );
  }

  private async fanout(event: any) {
    const rows = await this.prisma.$queryRawUnsafe<NearbyGeoState[]>(
      `SELECT user_id AS "userId", device_id AS "deviceId", latitude, longitude,
              accuracy_meters AS "accuracyMeters", last_evaluated_at AS "lastEvaluatedAt"
         FROM device_geo_states
        WHERE user_id <> $1::uuid
          AND last_evaluated_at >= NOW() - INTERVAL '5 minutes'`,
      event.initiatorUserId,
    );
    const eligible = rows
      .map((row) => ({
        row,
        result: dangerRecipientEligibility({
          dangerLatitude: Number(event.latitude),
          dangerLongitude: Number(event.longitude),
          recipientLatitude: Number(row.latitude),
          recipientLongitude: Number(row.longitude),
          recipientLocationAt: new Date(row.lastEvaluatedAt),
          recipientAccuracyMeters:
            row.accuracyMeters == null ? null : Number(row.accuracyMeters),
          radiusMeters: event.effectiveRadiusMeters,
        }),
      }))
      .filter((entry) => entry.result.eligible);
    let deliveredLocations = 0;
    const deliveredUsers = new Set<string>();
    for (const entry of eligible) {
      const result = await this.deliverDangerEvent(event, {
        recipientType: entry.row.deviceId ? "watch" : "mobile",
        recipientUserId: entry.row.userId,
        deviceId: entry.row.deviceId,
        distanceMeters: entry.result.distanceMeters,
        locationCapturedAt: new Date(entry.row.lastEvaluatedAt),
        reason: "INITIAL_ACTIVATION",
      });
      if (!result.suppressed) {
        deliveredLocations += 1;
        deliveredUsers.add(entry.row.userId);
      }
    }
    const fieldRecipients = await this.fanoutToFieldDevices(event);
    return {
      recipients: deliveredUsers.size,
      eligibleDeviceLocations: eligible.length,
      deliveredDeviceLocations: deliveredLocations,
      fieldRecipients,
      radiusMeters: event.effectiveRadiusMeters,
    };
  }

  private async fanoutToFieldDevices(event: any) {
    const devices = await (this.prisma as any).fieldDevice.findMany({
      where: {
        registrationStatus: "Active",
        isRevoked: false,
        isLost: false,
        assignedUserId: { not: null },
        lastKnownLatitude: { not: null },
        lastKnownLongitude: { not: null },
        lastLocationAt: { gte: new Date(Date.now() - 30 * 60_000) },
      },
      select: {
        id: true,
        assignedUserId: true,
        lastKnownLatitude: true,
        lastKnownLongitude: true,
        lastLocationAt: true,
        lastLocationAccuracy: true,
      },
      take: 500,
    });
    let delivered = 0;
    for (const device of devices) {
      const eligibility = dangerRecipientEligibility({
        dangerLatitude: Number(event.latitude),
        dangerLongitude: Number(event.longitude),
        recipientLatitude: Number(device.lastKnownLatitude),
        recipientLongitude: Number(device.lastKnownLongitude),
        recipientLocationAt: new Date(device.lastLocationAt),
        recipientAccuracyMeters:
          device.lastLocationAccuracy == null
            ? null
            : Number(device.lastLocationAccuracy),
        radiusMeters: Math.min(Number(event.effectiveRadiusMeters), OWNER_APPROVED_MAX_DANGER_RADIUS_METERS),
      });
      if (!eligibility.eligible) continue;
      const result = await this.deliverDangerEvent(event, {
        recipientType: "field",
        recipientUserId: device.assignedUserId,
        deviceId: device.id,
        distanceMeters: eligibility.distanceMeters,
        locationCapturedAt: new Date(device.lastLocationAt),
        reason: "INITIAL_ACTIVATION",
      });
      if (!result.suppressed) delivered += 1;
    }
    return delivered;
  }

  private async deliverDangerEvent(
    event: any,
    recipient: {
      recipientType: "mobile" | "watch" | "field";
      recipientUserId: string;
      deviceId?: string | null;
      distanceMeters: number;
      locationCapturedAt: Date;
      reason: "INITIAL_ACTIVATION" | "ACTIVE_ZONE_ENTRY";
    },
  ) {
    const version = Math.max(1, Number((event.metadata as any)?.alertRevision ?? 1));
    const recipientKey = `${recipient.recipientType}:${recipient.deviceId ?? recipient.recipientUserId}`;
    const claim = await this.claimDelivery(event.id, recipientKey, version, recipient);
    if (!claim) return { suppressed: true, reason: "delivery_dedupe" };

    const alertCode = this.normalizedDangerCode(event);
    const label = dangerLabel(alertCode);
    const area = this.spokenLocationName(
      (event.metadata as any)?.spokenLocationName,
    );
    const distanceLabel = recipient.distanceMeters < 1_000
      ? `${Math.max(1, Math.round(recipient.distanceMeters))} m`
      : `${(recipient.distanceMeters / 1_000).toFixed(1)} km`;
    const originalVoice = await this.findOriginalVoice(event);
    const expiresAt = new Date(
      Math.min(
        this.eventExpiry(event).getTime(),
        Date.now() + DANGER_ALERT_RELEVANCE_MS,
      ),
    );
    const dangerAlert = buildDangerZoneAlertPayload({
      zoneId: event.id,
      incidentId: event.incidentId,
      safetyAlertId: event.id,
      userId: recipient.recipientType === "field" ? undefined : recipient.recipientUserId,
      deviceId: recipient.deviceId,
      alertId: `danger-event:${event.id}:${recipientKey}`,
      incidentType: IncidentType.Emergency,
      alertState: recipient.distanceMeters <= 1_000 ? "Critical" : "Awareness",
      distanceMeters: recipient.distanceMeters,
      areaName: area,
      notificationPriority: "Critical",
      version,
      sequence: version,
      expiresAt,
      deepLink:
        recipient.recipientType === "field"
          ? `theeye-field://danger-trigger/events/${event.id}`
          : `theeye://danger-trigger/events/${event.id}`,
      hasOriginalVoice: originalVoice != null,
      metadata: { dangerAlertCode: alertCode },
      config: this.config as unknown as Record<string, unknown>,
    });
    const commonMetadata = {
      category: "DANGER_ALERT",
      dangerEventId: event.id,
      deviceId: recipient.deviceId,
      distanceMeters: Math.round(recipient.distanceMeters),
      approximateArea: area,
      preciseReporterLocationExposed: false,
      liveAvailable: !event.liveVoiceEndedAt,
      originalVoiceAvailable: originalVoice != null,
      originalVoiceProvenance: originalVoice ? "ORIGINAL_VOICE_NOTE" : undefined,
      deliveryReason: recipient.reason,
      deepLink: `/danger-trigger/events/${event.id}`,
      dangerAlert,
    };

    try {
      const notification = await this.notifications.create({
        ...(recipient.recipientType === "field"
          ? { adminUserId: recipient.recipientUserId }
          : { userId: recipient.recipientUserId }),
        type: "NearbyDangerWarning",
        priority: "Critical",
        channels:
          recipient.recipientType === "watch"
            ? ["watch_push"]
            : ["push", "in_app"],
        title: "DANGER ALERT",
        body: `${label} reported in ${area}. About ${distanceLabel} away.`,
        incidentId: event.incidentId,
        metadata: commonMetadata,
      });
      const notificationId = (notification as any)?.data?.[0]?.id ?? null;
      await (this.prisma as any).dangerEventDelivery.update({
        where: { id: claim.id },
        data: { status: "SENT", notificationId },
      });
      return { suppressed: false, notificationId, recipientKey };
    } catch (error) {
      await (this.prisma as any).dangerEventDelivery.update({
        where: { id: claim.id },
        data: { status: "FAILED", lastError: this.safeDeliveryError(error) },
      });
      throw error;
    }
  }

  private async claimDelivery(eventId: string, recipientKey: string, revision: number, recipient: any) {
    try {
      return await (this.prisma as any).dangerEventDelivery.create({
        data: {
          dangerEventId: eventId,
          recipientUserId: recipient.recipientUserId,
          recipientKey,
          recipientType: recipient.recipientType,
          alertRevision: revision,
          distanceMeters: recipient.distanceMeters,
          locationCapturedAt: recipient.locationCapturedAt,
          metadata: { reason: recipient.reason },
        },
      });
    } catch (error) {
      if ((error as any)?.code === "P2002") {
        const where = {
          dangerEventId_recipientKey_alertRevision: {
            dangerEventId: eventId,
            recipientKey,
            alertRevision: revision,
          },
        };
        const existing = await (this.prisma as any).dangerEventDelivery.findUnique({ where });
        if (existing?.status !== "FAILED" || Number(existing.attemptCount ?? 0) >= 3) {
          return null;
        }
        const claimed = await (this.prisma as any).dangerEventDelivery.updateMany({
          where: { id: existing.id, status: "FAILED", attemptCount: { lt: 3 } },
          data: {
            status: "QUEUED",
            attemptCount: { increment: 1 },
            lastError: null,
            locationCapturedAt: recipient.locationCapturedAt,
            distanceMeters: recipient.distanceMeters,
          },
        });
        if (claimed.count !== 1) return null;
        return (this.prisma as any).dangerEventDelivery.findUnique({ where });
      }
      throw error;
    }
  }

  private async findOriginalVoice(event: any) {
    return (this.prisma as any).incidentMedia.findFirst({
      where: {
        incidentId: event.incidentId,
        uploaderId: event.initiatorUserId ?? undefined,
        mediaType: "Audio",
        deletedAt: null,
        metadata: {
          path: ["provenance"],
          equals: "ORIGINAL_VOICE_NOTE",
        },
      },
      select: {
        id: true,
        objectKey: true,
        contentType: true,
        sizeBytes: true,
      },
      orderBy: { uploadedAt: "asc" },
    });
  }

  private eventExpiry(event: any) {
    const metadataExpiry = Date.parse(String((event.metadata as any)?.expiresAt ?? ""));
    const fallback = new Date(event.createdAt).getTime() + DANGER_EVENT_DEFAULT_ACTIVE_MS;
    return new Date(Number.isFinite(metadataExpiry) ? metadataExpiry : fallback);
  }

  private eventIsCurrentlyEffective(event: any, now: Date) {
    return event.state === "ACTIVE" && this.eventExpiry(event).getTime() > now.getTime();
  }

  private async persistMobileGeoState(input: TrustedDangerLocation) {
    const prisma = this.prisma as any;
    const existing = await prisma.deviceGeoState.findFirst({
      where: { userId: input.recipientUserId, deviceId: null },
      orderBy: { lastEvaluatedAt: "desc" },
    });
    const data = {
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracyMeters,
      lastEvaluatedAt: input.capturedAt,
    };
    const row = existing
      ? await prisma.deviceGeoState.update({ where: { id: existing.id }, data })
      : await prisma.deviceGeoState.create({
          data: { userId: input.recipientUserId, deviceId: null, ...data },
        });
    await this.prisma.$executeRawUnsafe(
      `UPDATE device_geo_states
          SET gps_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        WHERE id = $3::uuid`,
      input.longitude,
      input.latitude,
      row.id,
    );
  }

  private safeDeliveryError(error: unknown) {
    const name = error instanceof Error ? error.name : "DeliveryError";
    return name.slice(0, 120);
  }

  private normalizedDangerCode(event: any) {
    const code = String((event.metadata as any)?.dangerAlertCode ?? "");
    return Object.values(DangerAlertCode).includes(code as never)
      ? code
      : DangerAlertCode.GENERAL_ENTRY;
  }

  private spokenLocationName(value: unknown) {
    if (typeof value !== "string") return "the reported location";
    const normalized = value.trim().replace(/\s+/g, " ");
    return normalized && normalized.length <= 200
      ? normalized
      : "the reported location";
  }

  private buildWatchAlert(
    event: any,
    userId: string,
    distanceMeters: number,
    title: string,
    body: string,
  ) {
    const dangerAlert = buildDangerZoneAlertPayload({
      zoneId: event.id,
      incidentId: event.incidentId,
      safetyAlertId: event.id,
      userId,
      alertId: `danger-event:${event.id}:${userId}`,
      incidentType: IncidentType.Emergency,
      alertState: "Critical",
      distanceMeters,
      areaName: this.spokenLocationName(
        (event.metadata as any)?.spokenLocationName,
      ),
      notificationPriority: "Critical",
      deepLink: `theeye://danger-trigger/events/${event.id}`,
      metadata: { dangerAlertCode: this.normalizedDangerCode(event) },
      config: this.config as unknown as Record<string, unknown>,
    });
    return {
      title,
      body,
      dangerAlert,
      relayData: {
        type: "NearbyDangerWarning",
        relayToWatch: "true",
        title,
        body,
        ...dangerAlertPayloadToFcmData(dangerAlert),
      },
    };
  }

  private async notifyScopedAdmins(event: any) {
    const incident = await (this.prisma as any).incident.findUnique({
      where: { id: event.incidentId },
      select: { country: true, state: true, lga: true },
    });
    if (!incident) return 0;

    const admins = await (this.prisma as any).adminUser.findMany({
      where: {
        isActive: true,
        OR: [
          { role: { name: AdminRoleName.SuperAdmin } },
          {
            role: { name: AdminRoleName.CountryAdmin },
            country: incident.country,
          },
          {
            role: { name: AdminRoleName.StateAdmin },
            country: incident.country,
            state: incident.state,
          },
          {
            role: { name: { in: [AdminRoleName.LgaAdmin, AdminRoleName.CallCenterAgent, AdminRoleName.OversightAuditor] } },
            country: incident.country,
            state: incident.state,
            lga: incident.lga,
          },
        ],
      },
      select: { id: true },
      take: 100,
    });

    for (const admin of admins) {
      await this.notifications.create({
        adminUserId: admin.id,
        type: "EmergencyAlert",
        priority: "Critical",
        channels: ["in_app", "push"],
        title: "Live Danger Alert",
        body: `A live danger alert was activated in ${event.areaName || "your operational area"}.`,
        incidentId: event.incidentId,
        metadata: {
          category: "DANGER_ALERT",
          dangerEventId: event.id,
          approximateArea: event.areaName,
          preciseReporterLocationExposed: false,
          deepLink: `/incidents/${event.incidentId}`,
        },
      });
    }
    return admins.length;
  }

  private async assertCanAccess(event: any, actor: JwtPayload) {
    if (actor.typ === "admin") return;
    if (actor.typ === "field" && actor.fieldDeviceId) {
      const delivery = await (this.prisma as any).dangerEventDelivery.findFirst({
        where: {
          dangerEventId: event.id,
          recipientKey: `field:${actor.fieldDeviceId}`,
          status: "SENT",
        },
      });
      if (delivery) return;
      throw new ForbiddenException("This danger event is outside your authorized operational area");
    }
    if (actor.typ !== "user") throw new ForbiddenException("Citizen or authorized administrator required");
    if (event.initiatorUserId === actor.sub) return;
    const delivery = await (this.prisma as any).dangerEventDelivery.findFirst({
      where: {
        dangerEventId: event.id,
        recipientUserId: actor.sub,
        status: "SENT",
      },
    });
    if (delivery) return;
    const states = await (this.prisma as any).deviceGeoState.findMany({
      where: { userId: actor.sub },
      orderBy: { lastEvaluatedAt: "desc" },
      take: 10,
    });
    const eligible = states.some((state: any) => dangerRecipientEligibility({
      dangerLatitude: Number(event.latitude),
      dangerLongitude: Number(event.longitude),
      recipientLatitude: Number(state.latitude),
      recipientLongitude: Number(state.longitude),
      recipientLocationAt: state.lastEvaluatedAt,
      radiusMeters: event.effectiveRadiusMeters,
    }).eligible);
    if (!eligible) throw new ForbiddenException("This local danger event is outside your authorized area");
  }

  private startResponse(event: any, live: any, incidentId: string) {
    return {
      data: { event: this.publicEvent(event), liveSession: { ...live.data, incidentId } },
      livekit: live.livekit,
      connection: live.connection,
    };
  }

  private publicEvent(
    event: any,
    options: { originalVoiceAvailable?: boolean } = {},
  ) {
    return {
      id: event.id,
      incidentId: event.incidentId,
      state: event.state,
      severity: event.severity,
      approximateArea: event.areaName,
      effectiveRadiusMeters: event.effectiveRadiusMeters,
      maxRadiusMeters: Math.min(Number(event.maxRadiusMeters ?? 4_000), 4_000),
      liveVoiceSessionId: event.liveVoiceSessionId,
      liveVoiceEndedAt: event.liveVoiceEndedAt,
      originalVoiceAvailable: options.originalVoiceAvailable === true,
      cancelledAt: event.cancelledAt,
      createdAt: event.createdAt,
      preciseReporterLocationExposed: false,
    };
  }

  private assertCitizen(actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
  }
}
