import { BullModule } from "@nestjs/bullmq";
import { Module, forwardRef } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import { DANGER_ZONES_QUEUE_NAME } from "../../common/queue/queue-names";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { DangerZoneDeliveryService } from "./danger-zone-delivery.service";
import { DangerZoneGeoService } from "./danger-zone-geo.service";
import { DangerZoneTargetingService } from "./danger-zone-targeting.service";
import { DangerZonesController } from "./danger-zones.controller";
import { DangerZonesProcessor } from "./danger-zones.processor";
import { DangerZonesService } from "./danger-zones.service";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    NotificationsModule,
    ...(shouldRegisterBullMq() ? [BullModule.registerQueue({ name: DANGER_ZONES_QUEUE_NAME })] : []),
  ],
  controllers: [DangerZonesController],
  providers: [
    DangerZonesService,
    DangerZoneGeoService,
    DangerZoneTargetingService,
    DangerZoneDeliveryService,
    ...(shouldRegisterBullMq() ? [DangerZonesProcessor] : []),
    JwtAuthGuard,
    PermissionsGuard,
  ],
  exports: [DangerZonesService, DangerZoneTargetingService, DangerZoneGeoService],
})
export class DangerZonesModule {}
