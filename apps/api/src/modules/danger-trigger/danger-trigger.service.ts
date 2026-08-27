import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AdminRoleName, DangerAlertCode, IncidentPriority, IncidentStatus, IncidentType } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
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
  type StartDangerTriggerDto,
  validateStartDangerTriggerDto,
} from "./dto/danger-trigger.dto";
import {
  classifyDangerAreaRisk,
  DANGER_AREA_RISK_RADIUS_METERS,
  DANGER_AREA_RISK_WINDOW_DAYS,
  dangerClusterKey,
  dangerRecipientEligibility,
  OWNER_APPROVED_MAX_DANGER_RADIUS_METERS,
  resolveDangerRadius,
} from "./danger-trigger.policy";

type NearbyGeoState = {
  userId: string;
  deviceId: string | null;
  latitude: number;
  longitude: number;
  lastEvaluatedAt: Date;
};

const DANGER_ALERT_RELEVANCE_MS = 30 * 60 * 1000;

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
    return { data: this.publicEvent(event) };
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
              last_evaluated_at AS "lastEvaluatedAt"
         FROM device_geo_states
        WHERE user_id <> $1::uuid
          AND last_evaluated_at >= NOW() - INTERVAL '30 minutes'`,
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
          radiusMeters: event.effectiveRadiusMeters,
        }),
      }))
      .filter((entry) => entry.result.eligible);
    const byUser = new Map<string, typeof eligible>();
    for (const entry of eligible) {
      const list = byUser.get(entry.row.userId) ?? [];
      list.push(entry);
      byUser.set(entry.row.userId, list);
    }
    const alertCode = this.normalizedDangerCode(event);
    const label = dangerLabel(alertCode);
    const area = event.areaName?.trim() || "your area";
    const version = Math.max(1, Number((event.metadata as any)?.alertRevision ?? 1));
    const expiresAt = new Date(Date.now() + DANGER_ALERT_RELEVANCE_MS);
    for (const [userId, entries] of byUser) {
      entries.sort((a, b) => a.result.distanceMeters - b.result.distanceMeters);
      const nearest = entries[0]!;
      const distanceMeters = nearest.result.distanceMeters;
      const distanceLabel = distanceMeters < 1_000
        ? `${Math.max(1, Math.round(distanceMeters))} m`
        : `${(distanceMeters / 1_000).toFixed(1)} km`;
      const dangerAlert = buildDangerZoneAlertPayload({
        zoneId: event.id,
        incidentId: event.incidentId,
        safetyAlertId: event.id,
        userId,
        alertId: `danger-event:${event.id}:${userId}`,
        incidentType: IncidentType.Emergency,
        alertState: distanceMeters <= 1_000 ? "Critical" : "Awareness",
        distanceMeters,
        areaName: event.areaName ?? undefined,
        notificationPriority: "Critical",
        version,
        sequence: version,
        expiresAt,
        deepLink: `theeye://danger-trigger/events/${event.id}`,
        metadata: { dangerAlertCode: alertCode },
        config: this.config as unknown as Record<string, unknown>,
      });
      const commonMetadata = {
        category: "DANGER_ALERT",
        dangerEventId: event.id,
        distanceMeters: Math.round(distanceMeters),
        approximateArea: event.areaName,
        preciseReporterLocationExposed: false,
        liveAvailable: true,
        relayToWatch: true,
        watchLiveAudioSupported: false,
        deepLink: `/danger-trigger/events/${event.id}`,
        dangerAlert,
      };
      await this.notifications.create({
        userId,
        type: "NearbyDangerWarning",
        priority: "Critical",
        channels: ["push", "in_app"],
        title: "DANGER ALERT",
        body: `${label} reported in ${area}. About ${distanceLabel} away.`,
        incidentId: event.incidentId,
        metadata: commonMetadata,
      });
      await this.notifications.create({
        userId,
        type: "NearbyDangerWarning",
        priority: "Critical",
        channels: ["watch_push"],
        title: "DANGER ALERT",
        body: `${label} reported in ${area}. About ${distanceLabel} away.`,
        incidentId: event.incidentId,
        metadata: { ...commonMetadata, watchLiveAudioSupported: false },
      });
    }
    const fieldRecipients = await this.fanoutToFieldDevices(event, {
      alertCode,
      label,
      area,
      version,
      expiresAt,
    });
    return {
      recipients: byUser.size,
      eligibleDeviceLocations: eligible.length,
      fieldRecipients,
      radiusMeters: event.effectiveRadiusMeters,
    };
  }

  private async fanoutToFieldDevices(
    event: any,
    alert: { alertCode: string; label: string; area: string; version: number; expiresAt: Date },
  ) {
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
        radiusMeters: Math.min(Number(event.effectiveRadiusMeters), OWNER_APPROVED_MAX_DANGER_RADIUS_METERS),
      });
      if (!eligibility.eligible) continue;
      const dangerAlert = buildDangerZoneAlertPayload({
        zoneId: event.id,
        incidentId: event.incidentId,
        safetyAlertId: event.id,
        deviceId: device.id,
        alertId: `danger-event:${event.id}:field:${device.id}`,
        version: alert.version,
        sequence: alert.version,
        incidentType: IncidentType.Emergency,
        alertState: eligibility.distanceMeters <= 1_000 ? "Critical" : "Awareness",
        distanceMeters: eligibility.distanceMeters,
        areaName: alert.area,
        notificationPriority: "Critical",
        expiresAt: alert.expiresAt,
        deepLink: `theeye-field://danger-trigger/events/${event.id}`,
        metadata: { dangerAlertCode: alert.alertCode },
        config: this.config as unknown as Record<string, unknown>,
      });
      await this.notifications.create({
        adminUserId: device.assignedUserId,
        type: "NearbyDangerWarning",
        priority: "Critical",
        channels: ["push", "in_app"],
        title: "DANGER ALERT",
        body: `${alert.label} reported in ${alert.area}.`,
        incidentId: event.incidentId,
        metadata: {
          category: "DANGER_ALERT",
          dangerEventId: event.id,
          deviceId: device.id,
          approximateArea: alert.area,
          distanceMeters: Math.round(eligibility.distanceMeters),
          preciseReporterLocationExposed: false,
          liveAvailable: true,
          deepLink: `/danger-trigger/events/${event.id}`,
          dangerAlert,
        },
      });
      delivered += 1;
    }
    return delivered;
  }

  private normalizedDangerCode(event: any) {
    const code = String((event.metadata as any)?.dangerAlertCode ?? "");
    return Object.values(DangerAlertCode).includes(code as never)
      ? code
      : DangerAlertCode.GENERAL_ENTRY;
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
      areaName: event.areaName ?? undefined,
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
    if (actor.typ !== "user") throw new ForbiddenException("Citizen or authorized administrator required");
    if (event.initiatorUserId === actor.sub) return;
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

  private publicEvent(event: any) {
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
      cancelledAt: event.cancelledAt,
      createdAt: event.createdAt,
      preciseReporterLocationExposed: false,
    };
  }

  private assertCitizen(actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
  }
}
