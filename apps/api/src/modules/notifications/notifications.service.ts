import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import { Queue } from "bullmq";
import type { JwtPayload } from "../../common/auth/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { CreateNotificationDto, DeliveryReceiptDto, NotificationChannel, RegisterPushTokenDto, validateCreateNotificationDto, validateRegisterPushTokenDto } from "./dto/notification.dto";

type NotificationRecipient = {
  userId?: string;
  adminUserId?: string;
  distanceMeters?: number;
};

@Injectable()
export class NotificationsService {
  constructor(
    @Optional() @InjectQueue("notifications") private readonly queue: Queue | undefined,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateNotificationDto) {
    validateCreateNotificationDto(dto);
    const recipients = await this.resolveRecipients(dto);
    const channels = dto.channels?.length ? dto.channels : ["push", "in_app"] as NotificationChannel[];
    const created = [];

    for (const recipient of recipients) {
      for (const channel of channels) {
        const notification = await this.prisma.notification.create({
          data: {
            userId: recipient.userId,
            adminUserId: recipient.adminUserId,
            incidentId: dto.incidentId,
            broadcastId: dto.broadcastId,
            communityId: dto.communityId,
            type: dto.type,
            priority: dto.priority ?? this.defaultPriority(dto.type),
            channel,
            title: dto.title,
            body: dto.body,
            status: "Pending" as never,
            provider: this.providerForChannel(channel),
            targetLatitude: dto.latitude,
            targetLongitude: dto.longitude,
            targetRadiusMeters: dto.radiusMeters,
            metadata: { ...(dto.metadata ?? {}), distanceMeters: recipient.distanceMeters ?? null },
          } as never,
        });
        created.push(notification);
        await this.enqueue({ notificationId: notification.id, userId: recipient.userId, adminUserId: recipient.adminUserId, channel, title: dto.title, body: dto.body, type: dto.type, priority: dto.priority ?? this.defaultPriority(dto.type) });
      }
    }

    return { data: created, recipientCount: recipients.length, channelCount: channels.length };
  }

  async registerPushToken(dto: RegisterPushTokenDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new NotFoundException("Push tokens can only be registered for citizen users");
    validateRegisterPushTokenDto(dto);
    const token = await (this.prisma as any).userPushToken.upsert({
      where: { token: dto.token },
      update: { userId: actor.sub, platform: dto.platform, deviceId: dto.deviceId, isActive: true, lastSeenAt: new Date() },
      create: { userId: actor.sub, token: dto.token, platform: dto.platform, deviceId: dto.deviceId },
    });
    return { data: token };
  }

  async deactivatePushToken(token: string, actor: JwtPayload) {
    const updated = await (this.prisma as any).userPushToken.updateMany({
      where: { token, userId: actor.sub },
      data: { isActive: false },
    });
    return { updated: updated.count };
  }

  async enqueue(payload: any) {
    if (payload.notificationId) {
      await (this.prisma as any).notificationDeliveryLog.create({
        data: {
          notificationId: payload.notificationId,
          channel: payload.channel ?? "push",
          provider: payload.provider ?? this.providerForChannel(payload.channel ?? "push"),
          status: "Queued",
          requestPayload: payload,
        } as never,
      });
    }

    if (!this.queue) return { jobId: "local-dev-no-redis" };

    const job = await this.queue.add("dispatch", payload, {
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
    });
    return { jobId: job.id };
  }

  async listForActor(actor: JwtPayload, unreadOnly = false) {
    return {
      data: await this.prisma.notification.findMany({
        where: {
          ...(actor.typ === "user" ? { userId: actor.sub } : { adminUserId: actor.sub }),
          ...(unreadOnly ? { readAt: null } : {}),
        } as never,
        include: { broadcast: true, incident: true, deliveryLogs: { orderBy: { createdAt: "desc" }, take: 5 } } as never,
        orderBy: [{ priority: "desc" as never }, { createdAt: "desc" }],
        take: 100,
      }),
    };
  }

  async markRead(id: string, actor: JwtPayload) {
    const updated = await this.prisma.notification.updateMany({
      where: actor.typ === "user" ? { id, userId: actor.sub } : { id, adminUserId: actor.sub },
      data: { status: "Read" as never, readAt: new Date() },
    });
    return { updated: updated.count };
  }

  async markUnread(id: string, actor: JwtPayload) {
    const updated = await this.prisma.notification.updateMany({
      where: actor.typ === "user" ? { id, userId: actor.sub } : { id, adminUserId: actor.sub },
      data: { status: "Delivered" as never, readAt: null },
    });
    return { updated: updated.count };
  }

  async deliveryLogs(notificationId: string, actor: JwtPayload) {
    const notification = await this.prisma.notification.findFirst({
      where: actor.typ === "user" ? { id: notificationId, userId: actor.sub } : { id: notificationId },
    });
    if (!notification) throw new NotFoundException("Notification not found");
    return {
      data: await (this.prisma as any).notificationDeliveryLog.findMany({
        where: { notificationId },
        orderBy: { createdAt: "desc" },
      }),
    };
  }

  async recordDelivery(notificationId: string, channel: string, provider: string, receipt: DeliveryReceiptDto) {
    await (this.prisma as any).notificationDeliveryLog.create({
      data: {
        notificationId,
        channel,
        provider,
        status: receipt.status,
        providerMessageId: receipt.providerMessageId,
        error: receipt.error,
        responsePayload: receipt.responsePayload,
        sentAt: receipt.status === "Sent" || receipt.status === "Delivered" ? new Date() : undefined,
        deliveredAt: receipt.status === "Delivered" ? new Date() : undefined,
      } as never,
    });

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: receipt.status as never,
        provider,
        providerMessageId: receipt.providerMessageId,
        error: receipt.error,
        sentAt: receipt.status === "Sent" || receipt.status === "Delivered" ? new Date() : undefined,
      } as never,
    });
  }

  private async resolveRecipients(dto: CreateNotificationDto): Promise<NotificationRecipient[]> {
    if (dto.userId) return [{ userId: dto.userId }];
    if (dto.adminUserId) return [{ adminUserId: dto.adminUserId }];
    return this.findUsersNear(dto.latitude!, dto.longitude!, dto.radiusMeters!);
  }

  private async findUsersNear(latitude: number, longitude: number, radiusMeters: number) {
    return this.prisma.$queryRaw<Array<{ userId: string; distanceMeters: number }>>`
      WITH latest_user_location AS (
        SELECT DISTINCT ON (u.id)
               u.id AS user_id,
               COALESCE(i.gps_location, s.gps_location) AS gps_location
          FROM users u
          LEFT JOIN incidents i ON i.reporter_id = u.id
          LEFT JOIN sos_events s ON s.user_id = u.id
         WHERE COALESCE(i.gps_location, s.gps_location) IS NOT NULL
         ORDER BY u.id, i.created_at DESC NULLS LAST, s.triggered_at DESC NULLS LAST
      )
      SELECT user_id AS "userId",
             ST_Distance(gps_location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography) AS "distanceMeters"
        FROM latest_user_location
       WHERE ST_DWithin(gps_location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography, ${radiusMeters})
       LIMIT 500
    `;
  }

  private providerForChannel(channel: string) {
    if (channel === "push") return "firebase-cloud-messaging";
    if (channel === "sms") return "sms-placeholder";
    if (channel === "email") return "email-placeholder";
    if (channel === "watch_push") return "smartwatch-alert-adapter";
    return "in-app";
  }

  private defaultPriority(type: string) {
    if (["EmergencyAlert", "FamilySosAlert", "NearbyDangerWarning"].includes(type)) return "Critical";
    if (["MissingPersonAlert", "StolenVehicleAlert", "AdminAssignmentAlert"].includes(type)) return "High";
    return "Normal";
  }
}
