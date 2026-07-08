import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsProcessor } from "./notifications.processor";
import { NotificationsService } from "./notifications.service";

const redisDisabled = process.env.THE_EYE_DISABLE_REDIS === "1";

@Module({
  imports: [...(redisDisabled ? [] : [BullModule.registerQueue({ name: "notifications" })]), PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, ...(redisDisabled ? [] : [NotificationsProcessor]), JwtAuthGuard, PermissionsGuard],
  exports: [NotificationsService],
})
export class NotificationsModule {}
