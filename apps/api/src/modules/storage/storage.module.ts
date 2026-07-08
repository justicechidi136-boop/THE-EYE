import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { StorageController } from "./storage.controller";

@Module({
  controllers: [StorageController],
  providers: [JwtAuthGuard],
})
export class StorageModule {}
