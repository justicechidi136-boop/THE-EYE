import { validateEnvironment } from "../validate-env";
import {
  PRODUCTION_FIREBASE_PROJECT_ID,
  STAGING_FIREBASE_PROJECT_ID,
} from "../../common/auth/firebase-project";

const productionSecrets = {
  NODE_ENV: "production",
  THE_EYE_APP_ENV: "production",
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

function expectValidationFailure(config: Record<string, unknown>, messagePart: string) {
  try {
    validateEnvironment(config);
    throw new Error(`Expected validation failure containing "${messagePart}"`);
  } catch (error) {
    if (error instanceof Error && error.message === `Expected validation failure containing "${messagePart}"`) throw error;
    expect(String(error)).toContain(messagePart);
  }
}

describe("validateEnvironment firebase isolation", () => {
  it("rejects staging FCM project when THE_EYE_APP_ENV is production", () => {
    expectValidationFailure(
      {
        ...productionSecrets,
        FCM_PROJECT_ID: STAGING_FIREBASE_PROJECT_ID,
        FIREBASE_PROJECT_ID: STAGING_FIREBASE_PROJECT_ID,
      },
      "FIREBASE_PROJECT_ID must be the-eye-2pd-d0217 in production",
    );
  });

  it("rejects production FCM project when THE_EYE_APP_ENV is staging", () => {
    expectValidationFailure(
      {
        NODE_ENV: "development",
        THE_EYE_APP_ENV: "staging",
        FCM_PROJECT_ID: PRODUCTION_FIREBASE_PROJECT_ID,
        FIREBASE_PROJECT_ID: PRODUCTION_FIREBASE_PROJECT_ID,
      },
      "production Firebase project in staging",
    );
  });

  it("rejects production simulation flags", () => {
    expectValidationFailure(
      {
        ...productionSecrets,
        FCM_SIMULATION_MODE: "true",
      },
      "FCM simulation must be disabled in production",
    );
  });

  it("rejects production without credentials", () => {
    expectValidationFailure(
      {
        ...productionSecrets,
        FCM_CLIENT_EMAIL: "",
        FCM_PRIVATE_KEY: "",
      },
      "FCM credentials are required in production",
    );
  });

  it("accepts staging configuration", () => {
    const config = {
      NODE_ENV: "development",
      THE_EYE_APP_ENV: "staging",
      FCM_PROJECT_ID: STAGING_FIREBASE_PROJECT_ID,
      FIREBASE_PROJECT_ID: STAGING_FIREBASE_PROJECT_ID,
    };
    expect(validateEnvironment(config)).toBe(config);
  });
});
