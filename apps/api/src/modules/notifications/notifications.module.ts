import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { NOTIFICATIONS_QUEUE_NAME } from "../../common/queue/queue-names";
import { QueueMetricsService } from "../../common/metrics/queue-metrics.service";
import { HealthModule } from "../health/health.module";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationDeliveryService } from "./notification-delivery.service";
import { NotificationDispatcherService } from "./notification-dispatcher.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsProcessor } from "./notifications.processor";
import { NotificationsService } from "./notifications.service";
import { EmailProvider } from "./providers/email.provider";
import { FcmProvider } from "./providers/fcm.provider";
import { SmsProvider } from "./providers/sms.provider";

const redisDisabled = process.env.THE_EYE_DISABLE_REDIS === "1";

@Module({
  imports: [...(redisDisabled ? [] : [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE_NAME })]), PrismaModule, HealthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationDispatcherService,
    NotificationDeliveryService,
    FcmProvider,
    SmsProvider,
    EmailProvider,
    ...(redisDisabled ? [] : [NotificationsProcessor, QueueMetricsService]),
    JwtAuthGuard,
    PermissionsGuard,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
