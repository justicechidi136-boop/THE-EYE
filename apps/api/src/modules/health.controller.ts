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

    const [database, redis, notificationQueue, notificationWorker] = await Promise.all([

      this.health.checkDatabase(),

      this.health.checkRedis(),

      this.health.getNotificationQueueStatus(),

      this.health.getNotificationWorkerStatus(),

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

      firebaseAdmin: firebaseAdmin.configured ? "ok" : firebaseAdmin.simulation ? "degraded" : "error",

      firebaseAuth: firebaseAuth.projectId ? "ok" : "error",

    };



    const productionLike = isProductionLikeAppEnvironment();

    const healthy =

      (database === "ok" || database === "skipped") &&

      (!productionLike || redis === "ok") &&

      (!productionLike || notificationQueue.status === "ok") &&

      firebaseAuth.projectId;



    if (!healthy) {

      throw new ServiceUnavailableException({

        status: "degraded",

        checks,

        notificationQueue,

        notificationWorker,

        firebase,

        firebaseAdmin,

        firebaseAuth,

        timestamp: new Date().toISOString(),

      });

    }



    return {

      status: "ok",

      checks,

      notificationQueue,

      notificationWorker,

      firebase,

      firebaseAdmin,

      firebaseAuth,

      timestamp: new Date().toISOString(),

    };

  }

}

