import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import { INCIDENT_LOCATION_RETRY_QUEUE_NAME } from "../../common/queue/queue-names";
import { DispatchModule } from "./dispatch.module";
import { LocationRetryProcessor } from "./location-retry.processor";

@Module({
  imports: [
    DispatchModule,
    ...(shouldRegisterBullMq() ? [BullModule.registerQueue({ name: INCIDENT_LOCATION_RETRY_QUEUE_NAME })] : []),
  ],
  providers: [LocationRetryProcessor],
})
export class LocationRetryWorkerModule {}
