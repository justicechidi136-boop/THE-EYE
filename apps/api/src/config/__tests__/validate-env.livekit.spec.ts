import { validateEnvironment } from "../validate-env";
import {
  PRODUCTION_FIREBASE_PROJECT_ID,
} from "../../common/auth/firebase-project";

const productionConfig = {
  NODE_ENV: "production",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  LIVE_LOCATION_LINK_SECRET: "c".repeat(32),
  LIVEKIT_API_KEY: "APIMYSBVUUX8uNf",
  LIVEKIT_API_SECRET: "e".repeat(43),
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
  METRICS_BEARER_TOKEN: "h".repeat(32),
  FIREBASE_PROJECT_ID: PRODUCTION_FIREBASE_PROJECT_ID,
  FCM_PROJECT_ID: PRODUCTION_FIREBASE_PROJECT_ID,
  FCM_CLIENT_EMAIL: "firebase-adminsdk@test.iam.gserviceaccount.com",
  FCM_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
  FCM_MODE: "real",
  FCM_ALLOW_SIMULATION: "false",
  FCM_SIMULATION_MODE: "false",
  THE_EYE_DISABLE_REDIS: "0",
};

describe("validateEnvironment livekit credentials", () => {
  it("accepts short LiveKit Cloud API keys in production", () => {
    const stagingKeyConfig = {
      ...productionConfig,
      LIVEKIT_API_KEY: "APIMYSBVUUX8uNf",
    };
    expect(validateEnvironment(stagingKeyConfig)).toBe(stagingKeyConfig);

    const productionKeyConfig = {
      ...productionConfig,
      LIVEKIT_API_KEY: "APIGEgpLzPTAUGJ",
    };
    expect(validateEnvironment(productionKeyConfig)).toBe(productionKeyConfig);
  });

  it("rejects placeholder or too-short LiveKit API keys in production", () => {
    try {
      validateEnvironment({
        ...productionConfig,
        LIVEKIT_API_KEY: "devkey",
      });
      throw new Error("Expected devkey LIVEKIT_API_KEY rejection");
    } catch (error) {
      if (error instanceof Error && error.message === "Expected devkey LIVEKIT_API_KEY rejection") throw error;
      expect(String(error)).toContain("LIVEKIT_API_KEY");
    }

    try {
      validateEnvironment({
        ...productionConfig,
        LIVEKIT_API_KEY: "short",
      });
      throw new Error("Expected short LIVEKIT_API_KEY rejection");
    } catch (error) {
      if (error instanceof Error && error.message === "Expected short LIVEKIT_API_KEY rejection") throw error;
      expect(String(error)).toContain("LIVEKIT_API_KEY");
    }
  });

  it("still requires long LiveKit API secrets in production", () => {
    try {
      validateEnvironment({
        ...productionConfig,
        LIVEKIT_API_SECRET: "short-secret",
      });
      throw new Error("Expected short LIVEKIT_API_SECRET rejection");
    } catch (error) {
      if (error instanceof Error && error.message === "Expected short LIVEKIT_API_SECRET rejection") throw error;
      expect(String(error)).toContain("LIVEKIT_API_SECRET must be set to a production secret of at least 24 characters");
    }
  });
});
