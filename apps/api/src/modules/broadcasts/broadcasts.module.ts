import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import { BROADCASTS_QUEUE_NAME } from "../../common/queue/queue-names";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { VoiceAttachmentsModule } from "../voice-attachments/voice-attachments.module";
import { AdminBroadcastsController } from "./admin-broadcasts.controller";
import { BroadcastAdminService } from "./broadcast-admin.service";
import { BroadcastCitizenService } from "./broadcast-citizen.service";
import { BroadcastExpirySchedulerService } from "./broadcast-expiry.scheduler.service";
import { BroadcastLifecycleService } from "./broadcast-lifecycle.service";
import { BroadcastQueueService } from "./broadcast-queue.service";
import { BroadcastSchedulerDiagnosticsService } from "./broadcast-scheduler-diagnostics.service";
import { BroadcastShareService } from "./broadcast-share.service";
import { BroadcastsController } from "./broadcasts.controller";
import { BroadcastsService } from "./broadcasts.service";
import { PublicBroadcastShareController } from "./public-broadcast-share.controller";

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    AuditModule,
    VoiceAttachmentsModule,
    ...(shouldRegisterBullMq() ? [BullModule.registerQueue({ name: BROADCASTS_QUEUE_NAME })] : []),
  ],
  controllers: [BroadcastsController, AdminBroadcastsController, PublicBroadcastShareController],
  providers: [
    BroadcastsService,
    BroadcastCitizenService,
    BroadcastAdminService,
    BroadcastLifecycleService,
    BroadcastShareService,
    BroadcastExpirySchedulerService,
    BroadcastQueueService,
    BroadcastSchedulerDiagnosticsService,
    JwtAuthGuard,
    PermissionsGuard,
  ],
  exports: [
    BroadcastsService,
    BroadcastCitizenService,
    BroadcastAdminService,
    BroadcastLifecycleService,
    BroadcastSchedulerDiagnosticsService,
  ],
})
export class BroadcastsModule {}
