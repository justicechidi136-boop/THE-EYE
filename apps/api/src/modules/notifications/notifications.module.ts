import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import { NOTIFICATIONS_QUEUE_NAME } from "../../common/queue/queue-names";
import { QueueMetricsService } from "../../common/metrics/queue-metrics.service";
import { HealthModule } from "../health/health.module";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationQueueDiagnosticsService } from "./notification-queue-diagnostics.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsCoreModule } from "./notifications-core.module";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [
    PrismaModule,
    NotificationsCoreModule,
    ...(shouldRegisterBullMq() ? [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE_NAME })] : []),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    JwtAuthGuard,
    PermissionsGuard,
    ...(shouldRegisterBullMq() ? [NotificationQueueDiagnosticsService, QueueMetricsService] : []),
  ],
  exports: [NotificationsService, NotificationQueueDiagnosticsService],
})
export class NotificationsModule {}
