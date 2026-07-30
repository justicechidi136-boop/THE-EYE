import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import { WATCH_DANGER_ALERTS_QUEUE_NAME } from "../../common/queue/queue-names";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { WatchAlertTelemetryService } from "./watch-alert-telemetry.service";
import { WatchDangerAlertDeliveryService } from "./watch-danger-alert-delivery.service";
import { WatchDangerAlertProcessor } from "./watch-danger-alert.processor";

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    ...(shouldRegisterBullMq() ? [BullModule.registerQueue({ name: WATCH_DANGER_ALERTS_QUEUE_NAME })] : []),
  ],
  providers: [
    WatchAlertTelemetryService,
    WatchDangerAlertDeliveryService,
    ...(shouldRegisterBullMq() ? [WatchDangerAlertProcessor] : []),
  ],
  exports: [WatchAlertTelemetryService, WatchDangerAlertDeliveryService],
})
export class WatchDangerAlertWorkerModule {}
