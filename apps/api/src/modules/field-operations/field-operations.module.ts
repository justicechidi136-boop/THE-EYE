import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { FieldAuthService } from "./field-auth.service";
import { FieldDevicesAdminService } from "./field-devices-admin.service";
import { FieldDevicesService } from "./field-devices.service";
import { FieldAuthController, FieldDevicesAdminController, FieldDevicesController } from "./field-operations.controller";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [FieldDevicesController, FieldAuthController, FieldDevicesAdminController],
  providers: [FieldDevicesService, FieldAuthService, FieldDevicesAdminService],
  exports: [FieldDevicesService, FieldAuthService],
})
export class FieldOperationsModule {}
