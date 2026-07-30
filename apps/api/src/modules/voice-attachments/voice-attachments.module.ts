import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import { VOICE_TRANSCRIPTION_QUEUE_NAME } from "../../common/queue/queue-names";
import { MetricsModule } from "../../common/metrics/metrics.module";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StubTranscriptionProvider } from "./stub-transcription.provider";
import { OpenAiWhisperTranscriptionProvider } from "./openai-whisper-transcription.provider";
import { TranscriptionProviderFactory } from "./transcription-provider.factory";
import { VoiceTranslationProvider } from "./voice-translation.provider";
import { VoiceModerationProvider } from "./voice-moderation.provider";
import { VoicePostProcessingService } from "./voice-post-processing.service";
import { VoiceAnalyticsService } from "./voice-analytics.service";
import { VoiceAnalyticsController } from "./voice-analytics.controller";
import { VoiceAttachmentsController } from "./voice-attachments.controller";
import { CommunityVoiceAttachmentsController } from "./community-voice-attachments.controller";
import { VoiceAttachmentsService } from "./voice-attachments.service";
import { VoiceTranscriptionService } from "./voice-transcription.service";

@Module({
  imports: [
    AuditModule,
    MetricsModule,
    PrismaModule,
    ...(shouldRegisterBullMq()
      ? [BullModule.registerQueue({ name: VOICE_TRANSCRIPTION_QUEUE_NAME })]
      : []),
  ],
  controllers: [VoiceAttachmentsController, CommunityVoiceAttachmentsController, VoiceAnalyticsController],
  providers: [
    VoiceAttachmentsService,
    VoiceTranscriptionService,
    StubTranscriptionProvider,
    OpenAiWhisperTranscriptionProvider,
    TranscriptionProviderFactory,
    VoiceTranslationProvider,
    VoiceModerationProvider,
    VoicePostProcessingService,
    VoiceAnalyticsService,
  ],
  exports: [VoiceAttachmentsService, VoiceTranscriptionService],
})
export class VoiceAttachmentsModule {}
