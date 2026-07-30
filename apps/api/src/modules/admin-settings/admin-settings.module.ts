import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminSettingsController } from "./admin-settings.controller";
import { AdminSettingsService } from "./admin-settings.service";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AdminSettingsController],
  providers: [AdminSettingsService, JwtAuthGuard, PermissionsGuard],
  exports: [AdminSettingsService],
})
export class AdminSettingsModule {}
