import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { CommunityVerificationModule } from "../community-verification/community-verification.module";
import { DispatchModule } from "../dispatch/dispatch.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CitizenActivityController } from "./citizen-activity.controller";
import { CitizenActivityService } from "./citizen-activity.service";

@Module({
  imports: [PrismaModule, DispatchModule, CommunityVerificationModule],
  controllers: [CitizenActivityController],
  providers: [CitizenActivityService, JwtAuthGuard, PermissionsGuard],
  exports: [CitizenActivityService],
})
export class CitizenActivityModule {}
