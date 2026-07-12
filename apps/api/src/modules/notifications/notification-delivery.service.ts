import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { NotificationDispatchPayload, NotificationDispatchResult } from "./notification.types";

@Injectable()
export class NotificationDeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  async recordSuccess(payload: NotificationDispatchPayload, result: NotificationDispatchResult, attempt: number) {
    if (payload.notificationId) {
      await (this.prisma as any).notificationDeliveryLog.create({
        data: {
          notificationId: payload.notificationId,
          channel: payload.channel ?? "push",
          provider: result.provider,
          status: result.status,
          attempt,
          providerMessageId: result.providerMessageId,
          requestPayload: payload,
          responsePayload: result.responsePayload,
          sentAt: new Date(),
          deliveredAt: result.status === "Delivered" ? new Date() : undefined,
        } as never,
      });

      await this.prisma.notification.update({
        where: { id: payload.notificationId },
        data: {
          status: result.status as never,
          provider: result.provider,
          providerMessageId: result.providerMessageId,
          error: null,
          sentAt: new Date(),
        } as never,
      });

      await this.syncBroadcastDelivery(payload.notificationId, result.status === "Delivered" ? "Delivered" : "Sent");
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

    await (this.prisma as any).notificationDeliveryLog.create({
      data: {
        notificationId: payload.notificationId,
        channel: payload.channel ?? "push",
        provider: payload.provider ?? this.providerForChannel(payload.channel ?? "push"),
        status: isFinalAttempt ? "Failed" : "Retrying",
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
