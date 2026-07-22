import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import { NOTIFICATIONS_QUEUE_NAME } from "../../common/queue/queue-names";
import { PrismaModule } from "../prisma/prisma.module";
import { HealthService } from "./health.service";

@Module({
  imports: [
    PrismaModule,
    ...(shouldRegisterBullMq() ? [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE_NAME })] : []),
  ],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
