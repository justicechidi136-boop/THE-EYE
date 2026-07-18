import { signJwt, verifyJwt } from "../jwt";
import { validateEnvironment } from "../../../config/validate-env";

describe("authentication security", () => {
  it("rejects a JWT with an unsupported algorithm header", () => {
    const token = signJwt({ sub: "user-1", typ: "user" }, "test-secret", "15m");
    const [, payload, signature] = token.split(".");
    const badHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    expect(() => verifyJwt(`${badHeader}.${payload}.${signature}`, "test-secret")).toThrow();
  });

  it("requires strong production secrets and trusted origins", () => {
    expect(() => validateEnvironment({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "dev-access-secret",
    })).toThrow();
  });

  it("accepts a complete production security configuration", () => {
    const config = {
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      LIVE_LOCATION_LINK_SECRET: "c".repeat(32),
      LIVEKIT_API_KEY: "APIGEgpLzPTAUGJ",
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
      METRICS_BEARER_TOKEN: "h".repeat(32),
      FIREBASE_PROJECT_ID: "the-eye-2pd-d0217",
      FCM_PROJECT_ID: "the-eye-2pd-d0217",
      FCM_CLIENT_EMAIL: "firebase-adminsdk@test.iam.gserviceaccount.com",
      FCM_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
      FCM_MODE: "real",
      FCM_ALLOW_SIMULATION: "false",
      FCM_SIMULATION_MODE: "false",
      THE_EYE_DISABLE_REDIS: "0",
    };
    expect(validateEnvironment(config)).toBe(config);
  });

  it("rejects staging FIREBASE_PROJECT_ID in production", () => {
    try {
      validateEnvironment({
        NODE_ENV: "production",
        FIREBASE_PROJECT_ID: "the-eye-2stg",
        FCM_PROJECT_ID: "the-eye-2pd-d0217",
        FCM_CLIENT_EMAIL: "firebase-adminsdk@test.iam.gserviceaccount.com",
        FCM_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
        FCM_MODE: "real",
      });
      throw new Error("Expected staging FIREBASE_PROJECT_ID rejection");
    } catch (error) {
      if (error instanceof Error && error.message === "Expected staging FIREBASE_PROJECT_ID rejection") throw error;
      expect(String(error)).toContain("FIREBASE_PROJECT_ID");
    }
  });

  it("rejects mismatched FIREBASE_PROJECT_ID and FCM_PROJECT_ID", () => {
    try {
      validateEnvironment({
        NODE_ENV: "development",
        FIREBASE_PROJECT_ID: "the-eye-2stg",
        FCM_PROJECT_ID: "the-eye-29cff",
      });
      throw new Error("Expected FIREBASE/FCM mismatch rejection");
    } catch (error) {
      if (error instanceof Error && error.message === "Expected FIREBASE/FCM mismatch rejection") throw error;
      expect(String(error)).toContain("must match FCM_PROJECT_ID");
    }
  });

  it("accepts matching staging Firebase project configuration", () => {
    const config = {
      NODE_ENV: "development",
      FIREBASE_PROJECT_ID: "the-eye-2stg",
      FCM_PROJECT_ID: "the-eye-2stg",
    };
    expect(validateEnvironment(config)).toBe(config);
  });
});
