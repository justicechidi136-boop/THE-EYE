import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { DroneSurveillanceController } from "./drone-surveillance.controller";
import { DroneSurveillanceService } from "./drone-surveillance.service";

@Module({
  imports: [AuditModule],
  controllers: [DroneSurveillanceController],
  providers: [DroneSurveillanceService],
  exports: [DroneSurveillanceService],
})
export class DroneSurveillanceModule {}
