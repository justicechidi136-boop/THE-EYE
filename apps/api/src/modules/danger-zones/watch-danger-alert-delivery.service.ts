import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Queue } from "bullmq";
import { resolveWatchFeatureFlags } from "../../common/feature-flags/watch-feature-flags";
import { BullQueueEnqueueError } from "../../common/queue/bull-job-id";
import { WATCH_DANGER_ALERT_JOB_NAME, buildWatchDangerAlertJobId } from "../../common/queue/queue-jobs";
import { WATCH_DANGER_ALERTS_QUEUE_NAME } from "../../common/queue/queue-names";
import { safeQueueAdd } from "../../common/queue/safe-queue-add";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import type { WatchDangerAlertJobPayload } from "./watch-danger-alert.types";
import { WatchAlertTelemetryService } from "./watch-alert-telemetry.service";

@Injectable()
export class WatchDangerAlertDeliveryService {
  private readonly logger = new Logger(WatchDangerAlertDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly telemetry: WatchAlertTelemetryService,
    @Optional() @InjectQueue(WATCH_DANGER_ALERTS_QUEUE_NAME) private readonly queue?: Queue,
  ) {}

  async enqueueDelivery(payload: WatchDangerAlertJobPayload) {
    const flags = resolveWatchFeatureFlags(this.config as unknown as Record<string, unknown>);
    if (!flags.WATCH_SPOKEN_DANGER_ALERTS && !flags.WATCH_STANDALONE_ALERTS && !flags.WATCH_PHONE_RELAY) {
      return { queued: false, reason: "watch_alerts_disabled" };
    }

    if (!this.queue) {
      return this.dispatchNow(payload);
    }

    const jobId = buildWatchDangerAlertJobId(payload.safetyAlertId, payload.userId);
    try {
      await safeQueueAdd(
        this.queue,
        WATCH_DANGER_ALERT_JOB_NAME,
        payload,
        { jobId, removeOnComplete: 100, attempts: 5, backoff: { type: "exponential", delay: 3000 } },
        { safetyAlertId: payload.safetyAlertId, userId: payload.userId },
      );
      return { queued: true, jobId };
    } catch (error) {
      if (error instanceof BullQueueEnqueueError) {
        this.logger.warn(`Watch danger alert queue unavailable; dispatching inline (${payload.safetyAlertId})`);
        return this.dispatchNow(payload);
      }
      throw error;
    }
  }

  async dispatchNow(payload: WatchDangerAlertJobPayload) {
    const flags = resolveWatchFeatureFlags(this.config as unknown as Record<string, unknown>);
    const device = payload.deviceId
      ? await (this.prisma as any).smartwatchDevice.findUnique({ where: { id: payload.deviceId } })
      : null;

    const connectivityMode = String(device?.connectivityMode ?? "PairedPhone");
    const isStandalone = connectivityMode === "StandaloneCellular" || connectivityMode === "Standalone";
    const notificationMetadata = {
      dangerAlert: payload.dangerAlert,
      safetyAlertId: payload.safetyAlertId,
      dangerZoneId: payload.dangerZoneId,
      alertState: payload.alertState,
      deviceId: payload.deviceId,
      relayEligible: flags.WATCH_PHONE_RELAY && !isStandalone,
      featureFlags: flags,
    };

    const results: Array<{ channel: string; notificationId?: string }> = [];

    if (flags.WATCH_PHONE_RELAY && !isStandalone) {
      const phoneResult = await this.notifications.create(
        {
          userId: payload.userId,
          type: "NearbyDangerWarning",
          priority: payload.dangerAlert.priority === "CRITICAL" ? "Critical" : "High",
          channels: ["push", "in_app"],
          title: payload.title,
          body: payload.body,
          incidentId: payload.incidentId,
          metadata: {
            ...notificationMetadata,
            relayToWatch: true,
            pairedWatchDeviceId: device?.deviceId ?? payload.deviceId,
          },
        },
        { typ: "admin", sub: payload.actorAdminId, role: "SuperAdmin", permissions: ["broadcast:publish"] } as any,
      );
      const notificationId = phoneResult.data[0]?.id;
      results.push({ channel: "phone_relay", notificationId });
      await this.telemetry.record({
        safetyAlertId: payload.safetyAlertId,
        userId: payload.userId,
        deviceId: payload.deviceId,
        event: "relay_sent",
        channel: "phone_relay",
      });
    }

    if (flags.WATCH_STANDALONE_ALERTS && payload.deviceId) {
      const watchResult = await this.notifications.create(
        {
          userId: payload.userId,
          type: "NearbyDangerWarning",
          priority: payload.dangerAlert.priority === "CRITICAL" ? "Critical" : "High",
          channels: ["watch_push"],
          title: payload.title,
          body: payload.body,
          incidentId: payload.incidentId,
          metadata: {
            ...notificationMetadata,
            deliveryPath: isStandalone ? "standalone_fcm" : "failover_fcm",
          },
        },
        { typ: "admin", sub: payload.actorAdminId, role: "SuperAdmin", permissions: ["broadcast:publish"] } as any,
      );
      const notificationId = watchResult.data[0]?.id;
      results.push({ channel: "watch_push", notificationId });
      await this.telemetry.record({
        safetyAlertId: payload.safetyAlertId,
        userId: payload.userId,
        deviceId: payload.deviceId,
        event: "delivered",
        channel: "watch_push",
      });
    }

    return { dispatched: results.length, results };
  }
}
