import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { HealthService } from "./health/health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  live() {
    return {
      status: "ok",
      service: "the-eye-api",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ready")
  async ready() {
    const [database, redis] = await Promise.all([
      this.health.checkDatabase(),
      this.health.checkRedis(),
    ]);

    const checks = { database, redis };
    const healthy = Object.values(checks).every((value) => value === "ok" || value === "skipped");

    if (!healthy) {
      throw new ServiceUnavailableException({
        status: "degraded",
        checks,
        firebaseAdmin: this.health.getFirebaseAdminProbe(),
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: "ok",
      checks,
      firebaseAdmin: this.health.getFirebaseAdminProbe(),
      timestamp: new Date().toISOString(),
    };
  }
}
