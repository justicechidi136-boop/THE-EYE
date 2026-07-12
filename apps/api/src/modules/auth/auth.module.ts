import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { FirebaseAuthVerifier } from "../../common/auth/firebase-auth.verifier";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [AuditModule, PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, FirebaseAuthVerifier],
  exports: [AuthService],
})
export class AuthModule {}
