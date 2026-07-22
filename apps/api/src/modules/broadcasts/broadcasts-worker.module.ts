import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { shouldRegisterBullMq, shouldRegisterNotificationWorker } from "../../common/queue/queue-config";
import { BROADCASTS_QUEUE_NAME } from "../../common/queue/queue-names";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { WorkerHeartbeatService } from "../notifications/worker-heartbeat.service";
import { PrismaModule } from "../prisma/prisma.module";
import { BroadcastDispatchProcessor } from "./broadcast-dispatch.processor";
import { BroadcastQueueService } from "./broadcast-queue.service";
import { BroadcastSchedulerDiagnosticsService } from "./broadcast-scheduler-diagnostics.service";
import { BroadcastSchedulerService } from "./broadcast-scheduler.service";
import { BroadcastsService } from "./broadcasts.service";

const workerProviders = shouldRegisterNotificationWorker()
  ? [BroadcastSchedulerService, BroadcastDispatchProcessor, WorkerHeartbeatService]
  : [];

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    NotificationsModule,
    ...(shouldRegisterBullMq() ? [BullModule.registerQueue({ name: BROADCASTS_QUEUE_NAME })] : []),
  ],
  providers: [
    BroadcastsService,
    BroadcastQueueService,
    BroadcastSchedulerDiagnosticsService,
    ...workerProviders,
  ],
  exports: [BroadcastsService, BroadcastSchedulerDiagnosticsService],
})
export class BroadcastsWorkerModule {}
