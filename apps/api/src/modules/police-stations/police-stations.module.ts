import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { AuditModule } from "../audit/audit.module";
import { IncidentsModule } from "../incidents/incidents.module";
import { PrismaModule } from "../prisma/prisma.module";
import { GooglePlacesPoliceProvider } from "./google-places-police.provider";
import { PoliceLocatorService } from "./police-locator.service";
import { PoliceStationsController } from "./police-stations.controller";
import { PoliceStationsService } from "./police-stations.service";

@Module({
  imports: [PrismaModule, AuditModule, ConfigModule, IncidentsModule],
  controllers: [PoliceStationsController],
  providers: [
    PoliceStationsService,
    PoliceLocatorService,
    GooglePlacesPoliceProvider,
    JwtAuthGuard,
    PermissionsGuard,
  ],
  exports: [PoliceStationsService, PoliceLocatorService],
})
export class PoliceStationsModule {}
