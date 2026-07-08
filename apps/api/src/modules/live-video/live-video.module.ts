import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { LiveKitTokenService } from "./livekit-token.service";
import { LiveVideoController } from "./live-video.controller";
import { LiveVideoService } from "./live-video.service";

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [LiveVideoController],
  providers: [LiveVideoService, LiveKitTokenService, JwtAuthGuard, PermissionsGuard],
})
export class LiveVideoModule {}
