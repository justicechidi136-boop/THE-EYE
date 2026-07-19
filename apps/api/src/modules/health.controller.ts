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

    const firebaseAdmin = this.health.getFirebaseAdminProbe();
    const firebaseAuth = this.health.getFirebaseAuthProbe();
    const firebase = {
      appEnvironment: firebaseAdmin.appEnvironment,
      authProjectId: firebaseAuth.projectId,
      adminProjectId: firebaseAdmin.projectId,
      adminConfigured: firebaseAdmin.configured,
      adminSimulation: firebaseAdmin.simulation,
    };

    if (!healthy) {
      throw new ServiceUnavailableException({
        status: "degraded",
        checks,
        firebase,
        firebaseAdmin,
        firebaseAuth,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: "ok",
      checks,
      firebase,
      firebaseAdmin,
      firebaseAuth,
      timestamp: new Date().toISOString(),
    };
  }
}
