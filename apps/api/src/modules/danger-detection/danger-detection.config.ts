import type { ConfigService } from "@nestjs/config";

function value(config: ConfigService | undefined, key: string) {
  return config?.get<string>(key) ?? process.env[key];
}

function boundedNumber(raw: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function resolveDangerDetectionConfig(config?: ConfigService) {
  return {
    enabled: value(config, "DANGER_DETECTION_ENABLED") === "true",
    provider: (value(config, "DANGER_DETECTION_PROVIDER") ?? "disabled").trim().toLowerCase(),
    model: value(config, "OPENAI_DANGER_DETECTION_MODEL") ?? "gpt-4o-mini",
    openAiApiKey: value(config, "OPENAI_API_KEY"),
    confidenceThreshold: boundedNumber(value(config, "DANGER_DETECTION_CONFIDENCE_THRESHOLD"), 0.82, 0.5, 1),
    correlationRadiusMeters: boundedNumber(value(config, "DANGER_DETECTION_CORRELATION_RADIUS_METERS"), 1500, 100, 10000),
    correlationWindowMinutes: boundedNumber(value(config, "DANGER_DETECTION_CORRELATION_WINDOW_MINUTES"), 45, 5, 360),
    minimumCorrelatedSources: Math.round(boundedNumber(value(config, "DANGER_DETECTION_MIN_SOURCES"), 2, 1, 10)),
    providerTimeoutMs: boundedNumber(value(config, "DANGER_DETECTION_PROVIDER_TIMEOUT_MS"), 15000, 1000, 60000),
  };
}
