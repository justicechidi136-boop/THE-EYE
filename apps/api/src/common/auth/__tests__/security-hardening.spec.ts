import { validateEnvironment } from "../../../config/validate-env";

describe("security hardening", () => {
  it("requires metrics bearer protection in production", () => {
    try {
      validateEnvironment({
        NODE_ENV: "production",
        JWT_ACCESS_SECRET: "a".repeat(32),
        JWT_REFRESH_SECRET: "b".repeat(32),
        LIVE_LOCATION_LINK_SECRET: "c".repeat(32),
        LIVEKIT_API_KEY: "APIMYSBVUUX8uNf",
        LIVEKIT_API_SECRET: "e".repeat(32),
        S3_SECRET_KEY: "f".repeat(32),
        REDIS_PASSWORD: "g".repeat(32),
        CORS_ORIGINS: "https://admin.theeye.example",
        GOOGLE_OAUTH_CLIENT_ID: "client.apps.googleusercontent.com",
        DATABASE_URL: "postgresql://example",
        DATABASE_DIRECT_URL: "postgresql://example-direct",
        S3_ENDPOINT: "https://s3.example.com",
        S3_BUCKET: "the-eye",
        S3_ACCESS_KEY: "access-key",
        REDIS_HOST: "redis",
        ALLOW_DEV_AUTH_CODES: "false",
        FCM_PROJECT_ID: "the-eye-2pd-d0217",
        FCM_CLIENT_EMAIL: "firebase-adminsdk@test.iam.gserviceaccount.com",
        FCM_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
        FCM_MODE: "real",
        FCM_ALLOW_SIMULATION: "false",
        FCM_SIMULATION_MODE: "false",
        THE_EYE_DISABLE_REDIS: "0",
      });
      throw new Error("Expected validateEnvironment to throw");
    } catch (error) {
      if (error instanceof Error && error.message === "Expected validateEnvironment to throw") throw error;
      expect(String(error)).toContain("METRICS_BEARER_TOKEN");
    }
  });
});
