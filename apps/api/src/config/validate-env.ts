const productionSecrets = [
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "LIVE_LOCATION_LINK_SECRET",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "S3_SECRET_KEY",
  "REDIS_PASSWORD",
] as const;

export function validateEnvironment(config: Record<string, unknown>) {
  if (config.NODE_ENV !== "production") return config;

  for (const key of productionSecrets) {
    const value = config[key];
    if (typeof value !== "string" || value.length < 24 || value.startsWith("change_me") || value.startsWith("dev")) {
      throw new Error(`${key} must be set to a production secret of at least 24 characters`);
    }
  }

  if (typeof config.CORS_ORIGINS !== "string" || !config.CORS_ORIGINS.trim()) {
    throw new Error("CORS_ORIGINS must list trusted admin origins in production");
  }
  if (typeof config.GOOGLE_OAUTH_CLIENT_ID !== "string" || !config.GOOGLE_OAUTH_CLIENT_ID.trim()) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID is required in production");
  }
  for (const key of ["DATABASE_URL", "S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY"]) {
    if (typeof config[key] !== "string" || !String(config[key]).trim()) throw new Error(`${key} is required in production`);
  }
  return config;
}
