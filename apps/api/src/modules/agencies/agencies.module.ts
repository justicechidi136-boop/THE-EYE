import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AgenciesAdminController } from "./agencies-admin.controller";
import { AgenciesController } from "./agencies.controller";
import { AgenciesService } from "./agencies.service";
import { AgencyDirectoryController } from "./agency-directory.controller";
import { AgencyDirectoryService } from "./agency-directory.service";

@Module({
  imports: [AuditModule],
  controllers: [AgenciesController, AgenciesAdminController, AgencyDirectoryController],
  providers: [AgenciesService, AgencyDirectoryService],
  exports: [AgenciesService, AgencyDirectoryService],
})
export class AgenciesModule {}
