import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { UsersController } from "./users.controller";

@Module({
  controllers: [UsersController],
  providers: [JwtAuthGuard],
})
export class UsersModule {}
