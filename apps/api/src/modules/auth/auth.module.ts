import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { FirebaseAuthVerifier } from "../../common/auth/firebase-auth.verifier";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuthController } from "./auth.controller";
import { AuthDeliveryService } from "./auth-delivery.service";
import { AuthService } from "./auth.service";
import { AccountRecoveryService } from "./account-recovery.service";

@Module({
  imports: [AuditModule, PrismaModule, NotificationsModule],
  controllers: [AuthController],
  providers: [AuthService, AuthDeliveryService, AccountRecoveryService, JwtAuthGuard, FirebaseAuthVerifier],
  exports: [AuthService, AccountRecoveryService],
})
export class AuthModule {}
