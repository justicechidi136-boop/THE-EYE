import { BullModule } from "@nestjs/bullmq";
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { join } from "path";
import { MetricsModule } from "../common/metrics/metrics.module";
import { RateLimitModule } from "../common/rate-limit/rate-limit.module";
import { RequestContextMiddleware } from "../common/middleware/request-context.middleware";
import { JsonSafeInterceptor } from "../common/serialization/json-safe.interceptor";
import { resolveBullMqRootOptions, shouldRegisterBullMq } from "../common/queue/queue-config";
import { validateEnvironment } from "../config/validate-env";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { BroadcastsModule } from "./broadcasts/broadcasts.module";
import { EscalationModule } from "./escalation/escalation.module";
import { DispatchModule } from "./dispatch/dispatch.module";
import { HealthController } from "./health.controller";
import { HealthModule } from "./health/health.module";
import { IncidentsModule } from "./incidents/incidents.module";
import { LiveVideoModule } from "./live-video/live-video.module";
import { NeighborhoodWatchModule } from "./neighborhood-watch/neighborhood-watch.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PoliceStationsModule } from "./police-stations/police-stations.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SmartwatchModule } from "./smartwatch/smartwatch.module";
import { StorageModule } from "./storage/storage.module";
import { UsersModule } from "./users/users.module";
import { VerificationModule } from "./verification/verification.module";

const redisDisabled = !shouldRegisterBullMq();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, "../../.env"), join(process.cwd(), "apps/api/.env"), join(process.cwd(), ".env")],
      validate: validateEnvironment,
    }),
    MetricsModule,
    RateLimitModule,
    ...(redisDisabled
      ? []
      : [
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
        ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    IncidentsModule,
    BroadcastsModule,
    NotificationsModule,
    StorageModule,
    AuditModule,
    VerificationModule,
    EscalationModule,
    DispatchModule,
    NeighborhoodWatchModule,
    PoliceStationsModule,
    LiveVideoModule,
    SmartwatchModule,
  ],
  controllers: [HealthController],
  providers: [
    RequestContextMiddleware,
    { provide: APP_INTERCEPTOR, useClass: JsonSafeInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
