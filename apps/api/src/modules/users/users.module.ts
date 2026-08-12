import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { MeVehiclesController } from "./me-vehicles.controller";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [UsersController, MeVehiclesController],
  providers: [JwtAuthGuard, PermissionsGuard, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
