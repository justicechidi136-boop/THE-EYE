import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import { VOICE_TRANSCRIPTION_QUEUE_NAME } from "../../common/queue/queue-names";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StubTranscriptionProvider } from "./stub-transcription.provider";
import { StubTranslationProvider } from "./stub-translation.provider";
import { VoiceAttachmentsController } from "./voice-attachments.controller";
import { VoiceAttachmentsService } from "./voice-attachments.service";
import { VoiceTranscriptionService } from "./voice-transcription.service";

@Module({
  imports: [
    AuditModule,
    PrismaModule,
    ...(shouldRegisterBullMq()
      ? [BullModule.registerQueue({ name: VOICE_TRANSCRIPTION_QUEUE_NAME })]
      : []),
  ],
  controllers: [VoiceAttachmentsController],
  providers: [VoiceAttachmentsService, VoiceTranscriptionService, StubTranscriptionProvider, StubTranslationProvider],
  exports: [VoiceAttachmentsService, VoiceTranscriptionService],
})
export class VoiceAttachmentsModule {}
