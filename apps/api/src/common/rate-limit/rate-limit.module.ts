import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RateLimitGuard } from "./rate-limit.guard";
import { RateLimitService } from "./rate-limit.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RateLimitService, RateLimitGuard],
  exports: [RateLimitService, RateLimitGuard],
})
export class RateLimitModule {}
