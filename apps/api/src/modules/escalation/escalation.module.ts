import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { EscalationController } from "./escalation.controller";
import { EscalationService } from "./escalation.service";

@Module({
  imports: [AuditModule, PrismaModule],
  controllers: [EscalationController],
  providers: [EscalationService, JwtAuthGuard, PermissionsGuard],
  exports: [EscalationService],
})
export class EscalationModule {}
