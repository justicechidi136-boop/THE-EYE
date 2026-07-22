import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import { BROADCASTS_QUEUE_NAME } from "../../common/queue/queue-names";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { BroadcastSchedulerDiagnosticsService } from "./broadcast-scheduler-diagnostics.service";
import { BroadcastsController } from "./broadcasts.controller";
import { BroadcastsService } from "./broadcasts.service";

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    AuditModule,
    ...(shouldRegisterBullMq() ? [BullModule.registerQueue({ name: BROADCASTS_QUEUE_NAME })] : []),
  ],
  controllers: [BroadcastsController],
  providers: [BroadcastsService, BroadcastSchedulerDiagnosticsService, JwtAuthGuard, PermissionsGuard],
  exports: [BroadcastsService, BroadcastSchedulerDiagnosticsService],
})
export class BroadcastsModule {}
