import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { AuditModule } from "./audit/audit.module";
import { BroadcastsModule } from "./broadcasts/broadcasts.module";
import { IncidentsModule } from "./incidents/incidents.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PrismaModule } from "./prisma/prisma.module";
import { StorageModule } from "./storage/storage.module";
import { UsersModule } from "./users/users.module";
import { VerificationModule } from "./verification/verification.module";
import { EscalationModule } from "./escalation/escalation.module";
import { NeighborhoodWatchModule } from "./neighborhood-watch/neighborhood-watch.module";
import { PoliceStationsModule } from "./police-stations/police-stations.module";
import { LiveVideoModule } from "./live-video/live-video.module";
import { SmartwatchModule } from "./smartwatch/smartwatch.module";
import { validateEnvironment } from "../config/validate-env";
import { HealthController } from "./health.controller";

const redisDisabled = process.env.THE_EYE_DISABLE_REDIS === "1";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
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
})
export class AppModule {}


