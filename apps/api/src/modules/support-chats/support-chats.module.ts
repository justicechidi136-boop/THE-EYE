import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SupportChatsController } from "./support-chats.controller";
import { SupportChatsService } from "./support-chats.service";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SupportChatsController],
  providers: [JwtAuthGuard, PermissionsGuard, SupportChatsService],
  exports: [SupportChatsService],
})
export class SupportChatsModule {}
