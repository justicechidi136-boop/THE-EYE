import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { join } from "path";
import { MetricsModule } from "./common/metrics/metrics.module";
import { resolveBullMqRootOptions, shouldRegisterBullMq } from "./common/queue/queue-config";
import { validateEnvironment } from "./config/validate-env";
import { NotificationsWorkerModule } from "./modules/notifications/notifications-worker.module";
import { BroadcastsWorkerModule } from "./modules/broadcasts/broadcasts-worker.module";
import { PrismaModule } from "./modules/prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, "../.env"), join(process.cwd(), "apps/api/.env"), join(process.cwd(), ".env")],
      validate: validateEnvironment,
    }),
    MetricsModule,
    PrismaModule,
    ...(shouldRegisterBullMq()
      ? [
          BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) =>
              resolveBullMqRootOptions({
                REDIS_HOST: config.get<string>("REDIS_HOST"),
                REDIS_PORT: config.get<number>("REDIS_PORT"),
                REDIS_PASSWORD: config.get<string>("REDIS_PASSWORD"),
                REDIS_DB: config.get<number>("REDIS_DB"),
                REDIS_TLS: config.get<string>("REDIS_TLS"),
                BULLMQ_PREFIX: config.get<string>("BULLMQ_PREFIX"),
                REDIS_QUEUE_PREFIX: config.get<string>("REDIS_QUEUE_PREFIX"),
                THE_EYE_APP_ENV: config.get<string>("THE_EYE_APP_ENV"),
                FCM_PROJECT_ID: config.get<string>("FCM_PROJECT_ID"),
                FIREBASE_PROJECT_ID: config.get<string>("FIREBASE_PROJECT_ID"),
                NODE_ENV: process.env.NODE_ENV,
              }),
          }),
        ]
      : []),
    NotificationsWorkerModule,
    BroadcastsWorkerModule,
  ],
})
export class WorkerModule {}
