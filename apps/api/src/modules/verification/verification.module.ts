import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { BroadcastsModule } from "../broadcasts/broadcasts.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ConfidenceScorerService } from "./confidence-scorer.service";
import { VerificationController } from "./verification.controller";
import { VerificationService } from "./verification.service";

@Module({
  imports: [PrismaModule, BroadcastsModule],
  controllers: [VerificationController],
  providers: [VerificationService, ConfidenceScorerService, JwtAuthGuard, PermissionsGuard],
  exports: [VerificationService, ConfidenceScorerService],
})
export class VerificationModule {}
