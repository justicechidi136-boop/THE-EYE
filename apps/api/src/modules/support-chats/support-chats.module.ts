import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RateLimitModule } from "../../common/rate-limit/rate-limit.module";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SupportChatsAdminController } from "./support-chats-admin.controller";
import { SupportChatsCitizenController } from "./support-chats-citizen.controller";
import { SupportChatsService } from "./support-chats.service";

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule, RateLimitModule],
  controllers: [SupportChatsCitizenController, SupportChatsAdminController],
  providers: [JwtAuthGuard, PermissionsGuard, SupportChatsService],
  exports: [SupportChatsService],
})
export class SupportChatsModule {}
