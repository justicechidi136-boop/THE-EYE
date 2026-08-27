import { Injectable, Optional } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { isDangerClassification } from "@the-eye/shared";
import { resolveDangerDetectionConfig } from "./danger-detection.config";
import type { DangerClassifier, DangerClassifierInput, DangerClassifierResult } from "./danger-classifier.interface";

function outputText(body: any): string {
  if (typeof body?.output_text === "string") return body.output_text.trim();
  for (const output of Array.isArray(body?.output) ? body.output : []) {
    for (const part of Array.isArray(output?.content) ? output.content : []) {
      if (typeof part?.text === "string") return part.text.trim();
    }
  }
  return "";
}

@Injectable()
export class OpenAiDangerClassifier implements DangerClassifier {
  constructor(@Optional() private readonly config?: ConfigService) {}

  async classify(input: DangerClassifierInput): Promise<DangerClassifierResult> {
    const runtime = resolveDangerDetectionConfig(this.config);
    if (!runtime.openAiApiKey) throw new Error("DANGER_CLASSIFIER_NOT_CONFIGURED");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), runtime.providerTimeoutMs);
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${runtime.openAiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: runtime.model,
          input: [
            {
              role: "system",
              content: [
                "Classify immediate public-safety danger for THE EYE.",
                "Understand English, Hausa, Yoruba, Igbo, and Nigerian Pidgin in context.",
                "Suppress historical accounts, news/movie discussion, hypotheticals, quotations, jokes, and resolved events.",
                "Never infer facts not present. Classify current active threats conservatively.",
                "Treat userDeclaredDangerAlertCode as trusted user context, while independently classifying the evidence.",
                "Do not silently rewrite that declared value; return your probable category separately for backend policy review.",
                "Return JSON only with dangerLevel, category, immediateThreat, activeIncident, confidence (0..1),",
                "requiresVerification, detectedLocale, semanticTags, and contextSuppression.",
              ].join(" "),
            },
            {
              role: "user",
              content: JSON.stringify({
                sourceType: input.sourceType,
                sourceLocale: input.sourceLocale ?? "auto",
                occurredAt: input.occurredAt?.toISOString(),
                userDeclaredDangerAlertCode:
                  input.userDeclaredDangerAlertCode ?? null,
                text: input.text,
              }),
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "danger_classification",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["dangerLevel", "category", "immediateThreat", "activeIncident", "confidence", "requiresVerification", "detectedLocale", "semanticTags", "contextSuppression"],
                properties: {
                  dangerLevel: { enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
                  category: { enum: ["ACTIVE_SHOOTING", "ARMED_ATTACK", "ARMED_ROBBERY", "KIDNAPPING_IN_PROGRESS", "EXPLOSION", "FIRE_WITH_LIFE_RISK", "BOMB_OR_EXPLOSIVE_THREAT", "VIOLENT_MOB_OR_RIOT", "VEHICLE_ATTACK", "SERIOUS_WEAPON_ASSAULT", "MAJOR_HAZARDOUS_RELEASE", "OTHER_IMMEDIATE_LIFE_THREAT"] },
                  immediateThreat: { type: "boolean" },
                  activeIncident: { type: "boolean" },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  requiresVerification: { type: "boolean" },
                  detectedLocale: { type: ["string", "null"] },
                  semanticTags: { type: "array", items: { type: "string" }, maxItems: 8 },
                  contextSuppression: { enum: ["historical", "news", "fiction", "hypothetical", "quotation", "joke", null] },
                },
              },
            },
          },
        }),
      });
      if (!response.ok) throw new Error(`DANGER_CLASSIFIER_HTTP_${response.status}`);
      const parsed = JSON.parse(outputText(await response.json()));
      if (!isDangerClassification(parsed)) throw new Error("DANGER_CLASSIFIER_INVALID_RESPONSE");
      return { ...parsed, provider: "openai", model: runtime.model, version: 1 };
    } finally {
      clearTimeout(timeout);
    }
  }
}
