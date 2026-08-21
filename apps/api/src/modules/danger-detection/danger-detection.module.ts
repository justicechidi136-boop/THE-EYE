import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import { DANGER_DETECTION_QUEUE_NAME } from "../../common/queue/queue-names";
import { AuditModule } from "../audit/audit.module";
import { DangerDetectionController } from "./danger-detection.controller";
import { DangerDetectionService } from "./danger-detection.service";
import { dangerClassifierProvider } from "./danger-detection.providers";
import { DangerSourceLoader } from "./danger-source.loader";
import { OpenAiDangerClassifier } from "./openai-danger-classifier";
import { RiskDecisionEngine } from "./risk-decision.engine";

@Module({
  imports: [AuditModule, ...(shouldRegisterBullMq() ? [BullModule.registerQueue({ name: DANGER_DETECTION_QUEUE_NAME })] : [])],
  controllers: [DangerDetectionController],
  providers: [DangerDetectionService, DangerSourceLoader, RiskDecisionEngine, OpenAiDangerClassifier, dangerClassifierProvider],
  exports: [DangerDetectionService],
})
export class DangerDetectionModule {}
