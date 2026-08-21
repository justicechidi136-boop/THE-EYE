import { ConfigService } from "@nestjs/config";
import { DANGER_CLASSIFIER } from "./danger-classifier.interface";
import { resolveDangerDetectionConfig } from "./danger-detection.config";
import { OpenAiDangerClassifier } from "./openai-danger-classifier";

export const dangerClassifierProvider = {
  provide: DANGER_CLASSIFIER,
  inject: [OpenAiDangerClassifier, { token: ConfigService, optional: true }],
  useFactory: (openAi: OpenAiDangerClassifier, config?: ConfigService) => {
    const runtime = resolveDangerDetectionConfig(config);
    if (runtime.provider === "openai") return openAi;
    return {
      classify: async () => {
        throw new Error("DANGER_CLASSIFIER_NOT_CONFIGURED");
      },
    };
  },
};
