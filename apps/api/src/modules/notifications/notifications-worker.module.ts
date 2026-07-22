import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import { NOTIFICATIONS_QUEUE_NAME } from "../../common/queue/queue-names";
import { QueueMetricsService } from "../../common/metrics/queue-metrics.service";
import { NotificationQueueDiagnosticsService } from "./notification-queue-diagnostics.service";
import { NotificationsCoreModule } from "./notifications-core.module";
import { NotificationsProcessor } from "./notifications.processor";
import { WorkerHeartbeatService } from "./worker-heartbeat.service";

@Module({
  imports: [
    NotificationsCoreModule,
    ...(shouldRegisterBullMq() ? [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE_NAME })] : []),
  ],
  providers: [
    NotificationsProcessor,
    WorkerHeartbeatService,
    NotificationQueueDiagnosticsService,
    QueueMetricsService,
  ],
  exports: [NotificationsCoreModule, NotificationQueueDiagnosticsService],
})
export class NotificationsWorkerModule {}
