import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import { VOICE_TRANSCRIPTION_QUEUE_NAME } from "../../common/queue/queue-names";
import { MetricsModule } from "../../common/metrics/metrics.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StubTranscriptionProvider } from "./stub-transcription.provider";
import { OpenAiWhisperTranscriptionProvider } from "./openai-whisper-transcription.provider";
import { TranscriptionProviderFactory } from "./transcription-provider.factory";
import { VoiceTranslationProvider } from "./voice-translation.provider";
import { VoiceModerationProvider } from "./voice-moderation.provider";
import { VoicePostProcessingService } from "./voice-post-processing.service";
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
  providers: [
    VoiceTranscriptionService,
    VoiceTranscriptionProcessor,
    StubTranscriptionProvider,
    OpenAiWhisperTranscriptionProvider,
    TranscriptionProviderFactory,
    VoiceTranslationProvider,
    VoiceModerationProvider,
    VoicePostProcessingService,
  ],
})
export class VoiceTranscriptionWorkerModule {}
