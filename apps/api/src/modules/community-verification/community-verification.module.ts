import { Module } from "@nestjs/common";
import { createStorageDownloadUrl } from "../../common/storage/s3-presign";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CommunityVerificationAdminController } from "./community-verification-admin.controller";
import { CommunityVerificationController } from "./community-verification.controller";
import { CommunityVerificationEligibilityService } from "./community-verification-eligibility.service";
import { CommunityVerificationSafePayloadService } from "./community-verification-safe-payload.service";
import { CommunityVerificationScoringService } from "./community-verification-scoring.service";
import {
  COMMUNITY_VERIFICATION_SIGN_DOWNLOAD_URL,
  CommunityVerificationService,
} from "./community-verification.service";

@Module({
  imports: [PrismaModule, NotificationsModule, AuditModule],
  controllers: [CommunityVerificationController, CommunityVerificationAdminController],
  providers: [
    CommunityVerificationService,
    CommunityVerificationEligibilityService,
    CommunityVerificationScoringService,
    CommunityVerificationSafePayloadService,
    {
      provide: COMMUNITY_VERIFICATION_SIGN_DOWNLOAD_URL,
      useValue: createStorageDownloadUrl,
    },
    JwtAuthGuard,
    PermissionsGuard,
  ],
  exports: [CommunityVerificationService, CommunityVerificationScoringService],
})
export class CommunityVerificationModule {}
