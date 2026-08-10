import { Module } from "@nestjs/common";
import { AgenciesAdminController } from "./agencies-admin.controller";
import { AgenciesController } from "./agencies.controller";
import { AgenciesService } from "./agencies.service";

@Module({
  controllers: [AgenciesController, AgenciesAdminController],
  providers: [AgenciesService],
  exports: [AgenciesService],
})
export class AgenciesModule {}
