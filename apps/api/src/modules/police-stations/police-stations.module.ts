import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { PoliceStationsController } from "./police-stations.controller";
import { PoliceStationsService } from "./police-stations.service";

@Module({
  imports: [PrismaModule],
  controllers: [PoliceStationsController],
  providers: [PoliceStationsService, JwtAuthGuard, PermissionsGuard],
})
export class PoliceStationsModule {}
