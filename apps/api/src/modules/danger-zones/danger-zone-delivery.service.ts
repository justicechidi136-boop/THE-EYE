import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Queue } from "bullmq";
import { AdminRoleName } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { CreateNotificationDto } from "../notifications/dto/notification.dto";
import { DANGER_ZONES_QUEUE_NAME } from "../../common/queue/queue-names";
import { DANGER_ZONE_TARGET_JOB_NAME, buildDangerZoneActivateJobId } from "../../common/queue/queue-jobs";
import { BullQueueEnqueueError } from "../../common/queue/bull-job-id";
import { safeQueueAdd } from "../../common/queue/safe-queue-add";
import { buildDangerZoneAlertPayload } from "./danger-alert-payload";
import { readAccessibilityPreferencesFromMetadata } from "../smartwatch/watch-accessibility-preferences";

const STATE_TO_LEVEL: Record<string, string> = {
  InsideDangerZone: "P1Immediate",
  Critical: "P1Immediate",
  Approaching: "P2Serious",
  Awareness: "P3Awareness",
  MovingAway: "P3Awareness",
};

const COOLDOWN_MS: Record<string, number> = {
  Awareness: 15 * 60 * 1000,
  Approaching: 5 * 60 * 1000,
  Critical: 2 * 60 * 1000,
  InsideDangerZone: 60 * 1000,
};

@Injectable()
export class DangerZoneDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    @Optional() @InjectQueue(DANGER_ZONES_QUEUE_NAME) private readonly queue?: Queue,
  ) {}

  private systemActor(adminId: string): JwtPayload {
    return { typ: "admin", sub: adminId, role: AdminRoleName.SuperAdmin, permissions: ["broadcast:publish"] } as JwtPayload;
  }

  async enqueueZoneActivation(dangerZoneId: string) {
    if (!this.queue) {
      return this.dispatchZoneActivation(dangerZoneId);
    }
    const jobId = buildDangerZoneActivateJobId(dangerZoneId);
    try {
      await safeQueueAdd(
        this.queue,
        DANGER_ZONE_TARGET_JOB_NAME,
        { dangerZoneId, idempotencyKey: jobId },
        { jobId, removeOnComplete: 100, attempts: 5 },
        { dangerZoneId },
      );
    } catch (error) {
      if (error instanceof BullQueueEnqueueError) {
        return this.dispatchZoneActivation(dangerZoneId);
      }
      throw error;
    }
  }

  async dispatchZoneActivation(dangerZoneId: string) {
    const zone = await (this.prisma as any).dangerZone.findUnique({ where: { id: dangerZoneId } });
    if (!zone) return { dispatched: 0 };

    const recipients = await this.prisma.$queryRawUnsafe<Array<{ userId: string; deviceId: string | null; distanceMeters: number }>>(
      `SELECT dgs.user_id AS "userId", dgs.device_id AS "deviceId",
              ST_Distance(dgs.gps_location, dz.center_location) AS "distanceMeters"
         FROM device_geo_states dgs
         JOIN danger_zones dz ON dz.id = $1::uuid
        WHERE dgs.gps_location IS NOT NULL
          AND ST_Intersects(dgs.gps_location, dz.awareness_area)`,
      dangerZoneId,
    );

    let dispatched = 0;
    for (const recipient of recipients) {
      await this.deliverProximityAlert({
        dangerZoneId,
        userId: recipient.userId,
        deviceId: recipient.deviceId,
        alertState: Number(recipient.distanceMeters) <= zone.innerRadiusMeters ? "InsideDangerZone" : "Awareness",
        distanceMeters: Number(recipient.distanceMeters),
        incidentId: zone.incidentId,
        publicMessage: zone.publicMessage,
        avoidanceInstruction: zone.avoidanceInstruction,
        severity: zone.severity,
        actorAdminId: zone.createdByAdminId,
      });
      dispatched += 1;
    }
    return { dispatched };
  }

  async deliverProximityAlert(input: {
    dangerZoneId: string;
    userId: string;
    deviceId?: string | null;
    alertState: string;
    distanceMeters: number;
    incidentId: string;
    publicMessage: string;
    avoidanceInstruction: string;
    severity: string;
    actorAdminId: string;
  }) {
    const level = STATE_TO_LEVEL[input.alertState] ?? input.severity ?? "P2Serious";
    const dedupeKey = `safety:${input.dangerZoneId}:${input.userId}:${input.deviceId ?? "mobile"}:${input.alertState}`;
    const existing = await (this.prisma as any).safetyAlert.findUnique({ where: { dedupeKey } });
    if (existing) return { suppressed: true, reason: "dedupe" };

    const distanceLabel = Math.round(input.distanceMeters);
    const title =
      input.alertState === "InsideDangerZone" || input.alertState === "Critical"
        ? "DANGER AHEAD"
        : input.alertState === "Approaching"
          ? "Approaching danger zone"
          : "Area awareness";

    const body =
      input.alertState === "InsideDangerZone" || input.alertState === "Critical"
        ? `${input.publicMessage} Approximately ${distanceLabel} metres away. ${input.avoidanceInstruction}`
        : `${input.publicMessage} ${distanceLabel} metres from affected area. ${input.avoidanceInstruction}`;

    const alert = await (this.prisma as any).safetyAlert.create({
      data: {
        dangerZoneId: input.dangerZoneId,
        incidentId: input.incidentId,
        level: level as never,
        title,
        body,
        publicMessage: input.publicMessage,
        avoidanceInstruction: input.avoidanceInstruction,
        dedupeKey,
        metadata: { alertState: input.alertState, distanceMeters: input.distanceMeters },
      },
    });

    const incident = await (this.prisma as any).incident.findUnique({
      where: { id: input.incidentId },
      select: { type: true },
    });

    let languageHint: string | undefined;
    if (input.deviceId) {
      const watchDevice = await (this.prisma as any).smartwatchDevice.findUnique({
        where: { id: input.deviceId },
        select: { metadata: true },
      });
      if (watchDevice) {
        languageHint = readAccessibilityPreferencesFromMetadata(watchDevice.metadata).preferredSpokenLanguage;
      }
    }

    const dangerAlert = buildDangerZoneAlertPayload({
      zoneId: input.dangerZoneId,
      incidentId: input.incidentId,
      safetyAlertId: alert.id,
      incidentType: incident?.type,
      alertState: input.alertState,
      distanceMeters: input.distanceMeters,
      areaName: await this.resolveAreaName(input.dangerZoneId),
      languageHint: languageHint as never,
      notificationPriority: level === "P1Immediate" ? "Critical" : level === "P2Serious" ? "High" : "Normal",
      severity: level,
      deepLink: `theeye://danger-zone/${input.dangerZoneId}`,
    });

    const recipient = await (this.prisma as any).safetyAlertRecipient.create({
      data: {
        safetyAlertId: alert.id,
        userId: input.userId,
        deviceId: input.deviceId ?? null,
        alertState: input.alertState as never,
        distanceMeters: input.distanceMeters,
        cooldownUntil: new Date(Date.now() + (COOLDOWN_MS[input.alertState] ?? 300000)),
      },
    });

    const notificationDto: CreateNotificationDto = {
      userId: input.userId,
      type: "NearbyDangerWarning",
      priority: level === "P1Immediate" ? "Critical" : level === "P2Serious" ? "High" : "Normal",
      channels: [input.deviceId ? "watch_push" : "push", "in_app"],
      title,
      body,
      incidentId: input.incidentId,
      metadata: {
        dangerZoneId: input.dangerZoneId,
        safetyAlertId: alert.id,
        alertState: input.alertState,
        distanceMeters: input.distanceMeters,
        avoidanceInstruction: input.avoidanceInstruction,
        deviceId: input.deviceId,
        dangerAlert,
      },
    };

    const notificationResult = await this.notifications.create(notificationDto, this.systemActor(input.actorAdminId));
    const notificationId = notificationResult.data[0]?.id;

    await (this.prisma as any).safetyAlertDelivery.create({
      data: {
        safetyAlertId: alert.id,
        recipientId: recipient.id,
        notificationId,
        channel: input.deviceId ? "watch_push" : "push",
        status: "Queued",
      },
    });

    return { alertId: alert.id, notificationId };
  }

  private async resolveAreaName(dangerZoneId: string): Promise<string | undefined> {
    const zone = await (this.prisma as any).dangerZone.findUnique({
      where: { id: dangerZoneId },
      select: { lga: true, state: true },
    });
    if (!zone) return undefined;
    const parts = [zone.lga, zone.state].filter(Boolean);
    return parts.length ? parts.join(", ") : undefined;
  }

  async deliverAllClear(dangerZoneId: string, actorAdminId: string, status: string, reason: string) {
    const recipients = await (this.prisma as any).safetyAlertRecipient.findMany({
      where: { safetyAlert: { dangerZoneId } },
      include: { safetyAlert: true },
    });

    let deliveredCount = 0;
    for (const recipient of recipients) {
      if (!recipient.userId) continue;
      const title = "AREA STATUS UPDATED";
      const body = `The reported danger in your area has been reviewed. Status: ${status}. ${reason}`;
      const dangerAlert = buildDangerZoneAlertPayload({
        zoneId: dangerZoneId,
        incidentId: recipient.safetyAlert.incidentId,
        safetyAlertId: recipient.safetyAlertId,
        allClear: true,
        alertState: "AllClear",
        areaName: await this.resolveAreaName(dangerZoneId),
        notificationPriority: "Normal",
        acknowledgementRequired: false,
        repeatCount: 1,
      });

      await this.notifications.create(
        {
          userId: recipient.userId,
          type: "NearbyDangerWarning",
          priority: "Normal",
          channels: [recipient.deviceId ? "watch_push" : "push", "in_app"],
          title,
          body,
          incidentId: recipient.safetyAlert.incidentId,
          metadata: { dangerZoneId, allClear: true, status, safetyLevel: "P4AllClear", dangerAlert },
        },
        this.systemActor(actorAdminId),
      );
      deliveredCount += 1;
    }

    await (this.prisma as any).allClearEvent.create({
      data: {
        dangerZoneId,
        issuedByAdminId: actorAdminId,
        status,
        reason,
        recipientCount: recipients.length,
        deliveredCount,
      },
    });

    return { recipientCount: recipients.length, deliveredCount };
  }
}
