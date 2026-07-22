import { InjectQueue } from "@nestjs/bullmq";
import { ForbiddenException, Injectable, NotFoundException, Optional, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AdminRoleName } from "@the-eye/shared";
import { Queue } from "bullmq";
import type { JwtPayload } from "../../common/auth/jwt";
import { resolveAppEnvironment } from "../../common/auth/firebase-environment";
import {
  isProductionLikeAppEnvironment,
  isRedisExplicitlyDisabled,
} from "../../common/queue/queue-config";
import {
  buildNotificationDispatchJobId,
  buildNotificationIdempotencyKey,
  NOTIFICATION_DISPATCH_JOB_NAME,
} from "../../common/queue/queue-jobs";
import { NOTIFICATIONS_QUEUE_NAME } from "../../common/queue/queue-names";
import {
  buildCursorPage,
  dateIdCursorWhere,
  decodeDateIdCursor,
  encodeDateIdCursor,
  resolvePageLimit,
  type CursorPageQuery,
} from "../../common/pagination/cursor-pagination";
import { PrismaService } from "../prisma/prisma.service";
import { MetricsService } from "../../common/metrics/metrics.service";
import { FcmProvider } from "./providers/fcm.provider";
import { NotificationQueueDiagnosticsService } from "./notification-queue-diagnostics.service";
import { CreateNotificationDto, DeliveryReceiptDto, NotificationChannel, RegisterPushTokenDto, validateCreateNotificationDto, validateRegisterPushTokenDto } from "./dto/notification.dto";
import { bullJobAttempts, bullJobPriority, isEmergencyPriority } from "./notification.types";
import type { NotificationDispatchJobPayload, NotificationDispatchPayload } from "./notification.types";
import { isExpiredNotification, mapNotificationInboxItem } from "./notification-inbox.mapper";

type NotificationInboxQuery = CursorPageQuery & {
  unreadOnly?: boolean;
  category?: string;
  severity?: string;
  includeExpired?: boolean;
};

type ActorScope = {
  userId?: string;
  adminUserId?: string;
  oversightAdmin?: boolean;
};

@Injectable()
export class NotificationsService {
  constructor(
    @Optional() @InjectQueue(NOTIFICATIONS_QUEUE_NAME) private readonly queue: Queue | undefined,
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
    @Optional() private readonly queueDiagnostics?: NotificationQueueDiagnosticsService,
    @Optional() private readonly fcm?: FcmProvider,
  ) {}

  async create(dto: CreateNotificationDto, actor?: JwtPayload) {
    validateCreateNotificationDto(dto);
    if (actor?.typ === "admin" && actor.role !== AdminRoleName.SuperAdmin) {
      await this.assertAdminCanTarget(dto, actor);
    }
    const recipients = await this.resolveRecipients(dto);
    const channels = dto.channels?.length ? dto.channels : ["push", "in_app"] as NotificationChannel[];
    const priority = dto.priority ?? this.defaultPriority(dto.type);
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
            priority,
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
        await this.enqueue({
          notificationId: notification.id,
          userId: recipient.userId,
          adminUserId: recipient.adminUserId,
          channel,
          title: dto.title,
          body: dto.body,
          type: dto.type,
          priority,
          broadcastId: dto.broadcastId,
          incidentId: dto.incidentId,
          communityId: dto.communityId,
          provider: this.providerForChannel(channel),
        });
      }
    }

    return { data: created, recipientCount: recipients.length, channelCount: channels.length };
  }

  async registerPushToken(dto: RegisterPushTokenDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new NotFoundException("Push tokens can only be registered for citizen users");
    validateRegisterPushTokenDto(dto);
    const expectedEnvironment = this.resolveWorkerAppEnvironment();
    if (dto.appEnvironment && dto.appEnvironment !== expectedEnvironment) {
      throw new ForbiddenException(`Push tokens must be registered for ${expectedEnvironment}`);
    }
    const appEnvironment = dto.appEnvironment ?? expectedEnvironment;
    const token = await (this.prisma as any).userPushToken.upsert({
      where: { token: dto.token },
      update: {
        userId: actor.sub,
        platform: dto.platform,
        deviceId: dto.deviceId,
        provider: dto.provider ?? "firebase-cloud-messaging",
        appEnvironment,
        isActive: true,
        lastSeenAt: new Date(),
      },
      create: {
        userId: actor.sub,
        token: dto.token,
        platform: dto.platform,
        deviceId: dto.deviceId,
        provider: dto.provider ?? "firebase-cloud-messaging",
        appEnvironment,
      },
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

  async deactivateAllPushTokens(actor: JwtPayload, deviceId?: string) {
    if (actor.typ !== "user") throw new NotFoundException("Push tokens can only be deactivated for citizen users");
    const updated = await (this.prisma as any).userPushToken.updateMany({
      where: {
        userId: actor.sub,
        isActive: true,
        ...(deviceId ? { deviceId } : {}),
      },
      data: { isActive: false },
    });
    return { updated: updated.count };
  }

  async deactivatePushTokensForDevice(userId: string, deviceId: string) {
    const updated = await (this.prisma as any).userPushToken.updateMany({
      where: { userId, deviceId, isActive: true },
      data: { isActive: false },
    });
    return { updated: updated.count };
  }

  async recordDeviceReceived(
    notificationId: string,
    actor: JwtPayload,
    source: "foreground" | "background" | "opened" | "watch_ack" = "opened",
  ) {
    const scope = this.resolveActorScope(actor);
    const notification = await this.prisma.notification.findFirst({
      where: scope.oversightAdmin
        ? { id: notificationId }
        : scope.userId
          ? { id: notificationId, userId: scope.userId }
          : { id: notificationId, adminUserId: scope.adminUserId },
    });
    if (!notification) throw new NotFoundException("Notification not found");

    const metadata = (notification.metadata as Record<string, unknown> | null) ?? {};
    if (
      (notification.status === "Delivered" || notification.status === "Read") &&
      typeof metadata.deviceReceivedAt === "string"
    ) {
      return { acknowledged: true, notificationId, source, duplicate: true };
    }

    await (this.prisma as any).notificationDeliveryLog.create({
      data: {
        notificationId,
        channel: notification.channel ?? "push",
        provider: notification.provider ?? "firebase-cloud-messaging",
        status: "DeviceReceived",
        attempt: 0,
        responsePayload: { source, receivedAt: new Date().toISOString() },
        deliveredAt: new Date(),
      } as never,
    });

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: "Delivered" as never,
        metadata: {
          ...metadata,
          deviceReceivedAt: new Date().toISOString(),
          deviceReceivedSource: source,
        },
      } as never,
    });

    await this.syncBroadcastDelivery(notificationId, "Delivered");
    return { acknowledged: true, notificationId, source };
  }

  async getAdminDeliveryOperations(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can view delivery operations");

    const [queue, worker, groupedStatuses, recentFailures] = await Promise.all([
      this.queueDiagnostics?.getQueueDiagnostics() ?? Promise.resolve(null),
      this.queueDiagnostics?.getWorkerDiagnostics() ?? Promise.resolve(null),
      this.prisma.notification.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      (this.prisma as any).notificationDeliveryLog.findMany({
        where: { status: { in: ["Failed", "InvalidToken", "Retrying"] } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          notificationId: true,
          channel: true,
          provider: true,
          status: true,
          attempt: true,
          error: true,
          createdAt: true,
          notification: { select: { id: true, title: true, channel: true } },
        },
      }),
    ]);

    const summary = groupedStatuses.reduce<Record<string, number>>((acc, row) => {
      acc[String(row.status)] = row._count._all;
      return acc;
    }, {});

    return {
      queue,
      worker,
      fcm: this.fcm?.getRuntimeSnapshot() ?? null,
      summary,
      recentFailures,
      generatedAt: new Date().toISOString(),
    };
  }

  async enqueue(payload: NotificationDispatchPayload) {
    const jobPayload = this.buildJobPayload(payload);

    if (payload.notificationId) {
      await (this.prisma as any).notificationDeliveryLog.create({
        data: {
          notificationId: payload.notificationId,
          channel: payload.channel ?? "push",
          provider: payload.provider ?? this.providerForChannel(payload.channel ?? "push"),
          status: "Queued",
          attempt: 0,
          requestPayload: jobPayload,
        } as never,
      });
    }

    if (!this.queue) {
      if (isProductionLikeAppEnvironment() || !isRedisExplicitlyDisabled()) {
        throw new ServiceUnavailableException({
          status: "unavailable",
          code: "NOTIFICATION_QUEUE_UNAVAILABLE",
          message: "Notification queue is unavailable",
        });
      }
      return { jobId: null, queued: false, status: "Unavailable" as const, duplicate: false };
    }

    const jobId = buildNotificationDispatchJobId(jobPayload);
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      return { jobId, queued: true, status: "Queued" as const, duplicate: true, priority: existing.opts.priority, attempts: existing.opts.attempts };
    }

    const priority = bullJobPriority(payload.priority);
    const attempts = bullJobAttempts(payload.priority);
    const startedAt = Date.now();
    try {
      const job = await this.queue.add(NOTIFICATION_DISPATCH_JOB_NAME, jobPayload, {
        jobId,
        priority,
        attempts,
        backoff: { type: "exponential", delay: isEmergencyPriority(payload.priority) ? 2000 : 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      });
      this.metrics.recordRedisOperation("bullmq_enqueue", (Date.now() - startedAt) / 1000, "success");
      return { jobId: job.id, queued: true, status: "Queued" as const, duplicate: false, priority, attempts };
    } catch (error) {
      this.metrics.recordRedisOperation("bullmq_enqueue", (Date.now() - startedAt) / 1000, "error");
      throw error;
    }
  }

  private buildJobPayload(payload: NotificationDispatchPayload): NotificationDispatchJobPayload {
    return {
      ...payload,
      recipientUserId: payload.userId ?? payload.adminUserId,
      idempotencyKey: buildNotificationIdempotencyKey(payload),
      createdAt: payload.createdAt ?? new Date().toISOString(),
      enqueuedAt: new Date().toISOString(),
    };
  }

  async listForActor(actor: JwtPayload, query: NotificationInboxQuery = {}) {
    const limit = resolvePageLimit(query.limit);
    const cursor = decodeDateIdCursor(query.cursor);
    const scope = this.resolveActorScope(actor);
    const rows = await this.prisma.notification.findMany({
      where: {
        ...(scope.oversightAdmin ? {} : scope.userId ? { userId: scope.userId } : { adminUserId: scope.adminUserId }),
        ...(query.unreadOnly ? { readAt: null } : {}),
        ...(query.category ? { type: query.category } : {}),
        ...(query.severity ? { priority: query.severity } : {}),
        ...dateIdCursorWhere(cursor),
      } as never,
      include: { broadcast: true, incident: true, deliveryLogs: { orderBy: { createdAt: "desc" }, take: 5 } } as never,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const filtered = query.includeExpired ? rows : rows.filter((row) => !isExpiredNotification(row as never));
    const page = buildCursorPage(filtered, limit, (item) => encodeDateIdCursor(item.createdAt, item.id));
    const unreadCount = await this.countUnreadForActor(actor);
    return {
      ...page,
      data: page.data.map((row) => mapNotificationInboxItem(row as never)),
      meta: { unreadCount },
    };
  }

  async getForActor(id: string, actor: JwtPayload) {
    const scope = this.resolveActorScope(actor);
    const row = await this.prisma.notification.findFirst({
      where: scope.oversightAdmin
        ? { id }
        : scope.userId
          ? { id, userId: scope.userId }
          : { id, adminUserId: scope.adminUserId },
      include: { broadcast: true, incident: true, deliveryLogs: { orderBy: { createdAt: "desc" }, take: 10 } } as never,
    });
    if (!row) throw new NotFoundException("Notification not found");
    return { data: mapNotificationInboxItem(row as never) };
  }

  async countUnreadForActor(actor: JwtPayload) {
    const scope = this.resolveActorScope(actor);
    return this.prisma.notification.count({
      where: {
        ...(scope.oversightAdmin ? {} : scope.userId ? { userId: scope.userId } : { adminUserId: scope.adminUserId }),
        readAt: null,
      } as never,
    });
  }

  async markAllRead(actor: JwtPayload) {
    const scope = this.resolveActorScope(actor);
    const updated = await this.prisma.notification.updateMany({
      where: {
        ...(scope.oversightAdmin ? {} : scope.userId ? { userId: scope.userId } : { adminUserId: scope.adminUserId }),
        readAt: null,
      } as never,
      data: { status: "Read" as never, readAt: new Date() },
    });
    return { updated: updated.count, unreadCount: 0 };
  }

  async markRead(id: string, actor: JwtPayload) {
    const scope = this.resolveActorScope(actor);
    const updated = await this.prisma.notification.updateMany({
      where: scope.oversightAdmin
        ? { id }
        : scope.userId
          ? { id, userId: scope.userId }
          : { id, adminUserId: scope.adminUserId },
      data: { status: "Read" as never, readAt: new Date() },
    });
    return { updated: updated.count, unreadCount: await this.countUnreadForActor(actor) };
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

    if (receipt.status === "Failed") {
      await this.syncBroadcastDelivery(notificationId, "Failed");
    }
  }

  private resolveActorScope(actor: JwtPayload): ActorScope {
    const oversightAdmin =
      actor.typ === "admin" &&
      (actor.role === AdminRoleName.SuperAdmin || actor.role === AdminRoleName.OversightAuditor);
    return {
      oversightAdmin,
      userId: actor.typ === "user" ? actor.sub : undefined,
      adminUserId: actor.typ === "admin" ? actor.sub : undefined,
    };
  }

  private async resolveRecipients(dto: CreateNotificationDto): Promise<Array<{ userId?: string; adminUserId?: string; distanceMeters?: number }>> {
    if (dto.userId) return [{ userId: dto.userId }];
    if (dto.adminUserId) return [{ adminUserId: dto.adminUserId }];
    return this.findUsersNear(dto.latitude!, dto.longitude!, dto.radiusMeters!);
  }

  private async findUsersNear(latitude: number, longitude: number, radiusMeters: number) {
    return this.prisma.$queryRaw<Array<{ userId: string; distanceMeters: number }>>`
      WITH latest_user_location AS (
        SELECT DISTINCT ON (u.id)
               u.id AS user_id,
               COALESCE(vp.gps_location, i.gps_location, s.gps_location) AS gps_location
          FROM users u
          LEFT JOIN volunteer_profiles vp ON vp.user_id = u.id AND vp.gps_location IS NOT NULL
          LEFT JOIN incidents i ON i.reporter_id = u.id AND i.gps_location IS NOT NULL
          LEFT JOIN sos_events s ON s.user_id = u.id AND s.gps_location IS NOT NULL
         WHERE COALESCE(vp.gps_location, i.gps_location, s.gps_location) IS NOT NULL
         ORDER BY u.id, vp.created_at DESC NULLS LAST, i.created_at DESC NULLS LAST, s.triggered_at DESC NULLS LAST
      ),
      nearby_users AS (
        SELECT user_id AS "userId",
               ST_Distance(
                 gps_location,
                 ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
               ) AS "distanceMeters"
          FROM latest_user_location
         WHERE ST_DWithin(
           gps_location,
           ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
           ${radiusMeters}
         )
      )
      SELECT "userId", "distanceMeters"
        FROM nearby_users
       ORDER BY "distanceMeters" ASC
       LIMIT 500
    `;
  }

  private async syncBroadcastDelivery(notificationId: string, status: "Sent" | "Delivered" | "Failed") {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: { broadcastId: true, userId: true },
    });
    if (!notification?.broadcastId || !notification.userId) return;

    await this.prisma.broadcastDelivery.updateMany({
      where: { broadcastId: notification.broadcastId, userId: notification.userId },
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

  private resolveWorkerAppEnvironment() {
    return resolveAppEnvironment({
      THE_EYE_APP_ENV: this.config.get<string>("THE_EYE_APP_ENV"),
      FCM_PROJECT_ID: this.config.get<string>("FCM_PROJECT_ID"),
      FIREBASE_PROJECT_ID: this.config.get<string>("FIREBASE_PROJECT_ID"),
      NODE_ENV: process.env.NODE_ENV,
    });
  }

  private defaultPriority(type: string) {
    if (["EmergencyAlert", "FamilySosAlert", "NearbyDangerWarning"].includes(type)) return "Critical";
    if (["MissingPersonAlert", "StolenVehicleAlert", "AdminAssignmentAlert"].includes(type)) return "High";
    return "Normal";
  }

  private async assertAdminCanTarget(dto: CreateNotificationDto, actor: JwtPayload) {
    if (dto.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.userId },
        include: { profile: true },
      });
      if (!user?.profile) throw new ForbiddenException("Target user is outside your jurisdiction");
      const profile = user.profile;
      if (
        profile.country !== actor.country ||
        profile.state !== actor.state ||
        profile.lga !== actor.lga
      ) {
        throw new ForbiddenException("Target user is outside your jurisdiction");
      }
      return;
    }
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      const jurisdiction = await this.prisma.jurisdiction.findFirst({
        where: {
          country: actor.country,
          state: actor.state,
          lga: actor.lga,
        },
        select: { id: true },
      });
      if (!jurisdiction) throw new ForbiddenException("Admin jurisdiction is not configured");
    }
  }
}
