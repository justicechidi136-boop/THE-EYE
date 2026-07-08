import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { ConfidenceScorerService } from "./confidence-scorer.service";
import { VerificationController } from "./verification.controller";
import { VerificationService } from "./verification.service";

@Module({
  controllers: [VerificationController],
  providers: [VerificationService, ConfidenceScorerService, JwtAuthGuard, PermissionsGuard],
  exports: [VerificationService, ConfidenceScorerService],
})
export class VerificationModule {}
