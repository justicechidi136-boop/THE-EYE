import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import { VOICE_TRANSCRIPTION_QUEUE_NAME } from "../../common/queue/queue-names";
import { MetricsModule } from "../../common/metrics/metrics.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StubTranscriptionProvider } from "./stub-transcription.provider";
import { StubTranslationProvider } from "./stub-translation.provider";
import { VoiceTranscriptionProcessor } from "./voice-transcription.processor";
import { VoiceTranscriptionService } from "./voice-transcription.service";

@Module({
  imports: [
    MetricsModule,
    PrismaModule,
    ...(shouldRegisterBullMq()
      ? [BullModule.registerQueue({ name: VOICE_TRANSCRIPTION_QUEUE_NAME })]
      : []),
  ],
  providers: [VoiceTranscriptionService, VoiceTranscriptionProcessor, StubTranscriptionProvider, StubTranslationProvider],
})
export class VoiceTranscriptionWorkerModule {}
