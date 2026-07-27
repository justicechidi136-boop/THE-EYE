import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { isProductionLikeAppEnvironment } from "../common/queue/queue-config";
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
    const [database, redis, notificationQueue, notificationWorker, locationRetryQueue, locationRetryWorker, prismaSchema] =
      await Promise.all([
        this.health.checkDatabase(),
        this.health.checkRedis(),
        this.health.getNotificationQueueStatus(),
        this.health.getNotificationWorkerStatus(),
        this.health.getLocationRetryQueueStatus(),
        this.health.getLocationRetryWorkerStatus(),
        this.health.checkPrismaSchemaCompatibility(),
      ]);

    const firebaseAdmin = this.health.getFirebaseAdminProbe();
    const firebaseAuth = this.health.getFirebaseAuthProbe();
    const firebase = {
      appEnvironment: firebaseAdmin.appEnvironment,
      authProjectId: firebaseAuth.projectId,
      adminProjectId: firebaseAdmin.projectId,
      adminConfigured: firebaseAdmin.configured,
      adminSimulation: firebaseAdmin.simulation,
    };

    const checks = {
      database,
      redis,
      notificationQueue: notificationQueue.status,
      notificationWorker: notificationWorker.status,
      locationRetryQueue: locationRetryQueue.status,
      locationRetryWorker: locationRetryWorker.status,
      firebaseAdmin: firebaseAdmin.configured ? "ok" : firebaseAdmin.simulation ? "degraded" : "error",
      firebaseAuth: firebaseAuth.projectId ? "ok" : "error",
      prismaClient: prismaSchema.prismaClient,
      incidentLocationModel: prismaSchema.incidentLocationModel,
      incidentLocationCreateCapability: prismaSchema.incidentLocationCreateCapability,
      schemaCompatibility: prismaSchema.schemaCompatibility,
    };

    const productionLike = isProductionLikeAppEnvironment();
    const healthy =
      (database === "ok" || database === "skipped") &&
      prismaSchema.schemaCompatibility === "ok" &&
      prismaSchema.incidentLocationCreateCapability !== "error" &&
      (!productionLike || redis === "ok") &&
      (!productionLike || notificationQueue.status === "ok") &&
      (!productionLike || locationRetryQueue.status === "ok") &&
      firebaseAuth.projectId;

    const payload = {
      status: healthy ? "ok" : "degraded",
      checks,
      prismaSchema,
      notificationQueue,
      notificationWorker,
      locationRetryQueue,
      locationRetryWorker,
      firebase,
      firebaseAdmin,
      firebaseAuth,
      timestamp: new Date().toISOString(),
    };

    if (!healthy) {
      throw new ServiceUnavailableException(payload);
    }

    return payload;
  }
}
