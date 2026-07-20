import { BullModule } from "@nestjs/bullmq";
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { join } from "path";
import { MetricsModule } from "../common/metrics/metrics.module";
import { RateLimitModule } from "../common/rate-limit/rate-limit.module";
import { RequestContextMiddleware } from "../common/middleware/request-context.middleware";
import { JsonSafeInterceptor } from "../common/serialization/json-safe.interceptor";
import { validateEnvironment } from "../config/validate-env";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { BroadcastsModule } from "./broadcasts/broadcasts.module";
import { EscalationModule } from "./escalation/escalation.module";
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

const redisDisabled = process.env.THE_EYE_DISABLE_REDIS === "1";

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
            useFactory: (config: ConfigService) => ({
              connection: {
                host: config.get<string>("REDIS_HOST", "localhost"),
                port: config.get<number>("REDIS_PORT", 6379),
                password: config.get<string>("REDIS_PASSWORD") || undefined,
              },
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
