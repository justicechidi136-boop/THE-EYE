import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  mapBroadcastDeliveryStatusFromProvider,
  mapProviderResultToDeliveryLogStatus,
  mapProviderResultToNotificationStatus,
} from "./notification-delivery-status";
import type { NotificationDispatchPayload, NotificationDispatchResult } from "./notification.types";

@Injectable()
export class NotificationDeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  async recordSuccess(payload: NotificationDispatchPayload, result: NotificationDispatchResult, attempt: number) {
    if (payload.notificationId) {
      const logStatus = mapProviderResultToDeliveryLogStatus(result);
      const notificationStatus = mapProviderResultToNotificationStatus(result);

      await (this.prisma as any).notificationDeliveryLog.create({
        data: {
          notificationId: payload.notificationId,
          channel: payload.channel ?? "push",
          provider: result.provider,
          status: logStatus,
          attempt,
          providerMessageId: result.providerMessageId,
          requestPayload: payload,
          responsePayload: result.responsePayload,
          sentAt: logStatus === "Failed" ? undefined : new Date(),
          deliveredAt: logStatus === "Delivered" ? new Date() : undefined,
        } as never,
      });

      await this.prisma.notification.update({
        where: { id: payload.notificationId },
        data: {
          status: notificationStatus as never,
          provider: result.provider,
          providerMessageId: result.providerMessageId,
          error: logStatus === "Failed" ? "Provider dispatch was simulated or unavailable" : null,
          sentAt: notificationStatus === "Failed" ? undefined : new Date(),
        } as never,
      });

      await this.syncBroadcastDelivery(
        payload.notificationId,
        mapBroadcastDeliveryStatusFromProvider(result),
      );
    }
  }

  async recordFailure(
    payload: NotificationDispatchPayload,
    errorMessage: string,
    attempt: number,
    maxAttempts: number,
    isFinalAttempt: boolean,
    responsePayload?: Record<string, unknown>,
  ) {
    if (!payload.notificationId) return;

    const invalidToken = `${errorMessage} ${JSON.stringify(responsePayload ?? {})}`.toLowerCase().includes("invalid token")
      || `${errorMessage}`.toLowerCase().includes("unregistered");

    await (this.prisma as any).notificationDeliveryLog.create({
      data: {
        notificationId: payload.notificationId,
        channel: payload.channel ?? "push",
        provider: payload.provider ?? this.providerForChannel(payload.channel ?? "push"),
        status: isFinalAttempt ? (invalidToken ? "InvalidToken" : "Failed") : "Retrying",
        attempt,
        error: errorMessage,
        requestPayload: payload,
        responsePayload: { ...responsePayload, maxAttempts, isFinalAttempt },
      } as never,
    });

    if (isFinalAttempt) {
      await this.prisma.notification.update({
        where: { id: payload.notificationId },
        data: {
          status: "Failed" as never,
          provider: payload.provider ?? this.providerForChannel(payload.channel ?? "push"),
          error: errorMessage,
        } as never,
      });
      await this.syncBroadcastDelivery(payload.notificationId, "Failed");
    }
  }

  private async syncBroadcastDelivery(notificationId: string, status: "Sent" | "Delivered" | "Failed") {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: { broadcastId: true, userId: true },
    });

    if (!notification?.broadcastId || !notification.userId) return;

    await this.prisma.broadcastDelivery.updateMany({
      where: {
        broadcastId: notification.broadcastId,
        userId: notification.userId,
      },
      data: {
        status: status as never,
        notificationId,
        sentAt: status === "Failed" ? undefined : new Date(),
      } as never,
    });
  }

  private providerForChannel(channel: string) {
    if (channel === "push" || channel === "watch_push") return "firebase-cloud-messaging";
    if (channel === "sms") return "sms-placeholder";
    if (channel === "email") return "email-placeholder";
    return "in-app";
  }
}
