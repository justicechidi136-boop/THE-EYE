import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { DroneOperatorController } from "./drone-operator.controller";
import { DroneOperatorService } from "./drone-operator.service";
import { DroneSurveillanceController } from "./drone-surveillance.controller";
import { DroneSurveillanceService } from "./drone-surveillance.service";

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [DroneSurveillanceController, DroneOperatorController],
  providers: [DroneSurveillanceService, DroneOperatorService],
  exports: [DroneSurveillanceService, DroneOperatorService],
})
export class DroneSurveillanceModule {}
