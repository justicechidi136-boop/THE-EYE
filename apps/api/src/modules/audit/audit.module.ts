import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditController } from "./audit.controller";
import { AuditContextMiddleware } from "./audit-context.middleware";
import { AuditService } from "./audit.service";

@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [AuditService, AuditContextMiddleware, JwtAuthGuard, PermissionsGuard],
  exports: [AuditService],
})
export class AuditModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuditContextMiddleware).forRoutes("*");
  }
}
