import {
  assertProductionFirebaseGuard,
  assertStagingFirebaseGuard,
  resolveAppEnvironment,
} from "../firebase-environment";
import {
  PRODUCTION_FIREBASE_PROJECT_ID,
  STAGING_FIREBASE_PROJECT_ID,
} from "../firebase-project";
import { hasFcmCredentialSource } from "../firebase-credentials";

function expectGuardFailure(fn: () => void, messagePart: string) {
  try {
    fn();
    throw new Error(`Expected guard failure containing "${messagePart}"`);
  } catch (error) {
    if (error instanceof Error && error.message === `Expected guard failure containing "${messagePart}"`) throw error;
    expect(String(error)).toContain(messagePart);
  }
}

describe("firebase-environment guards", () => {
  const productionCredentials = {
    FCM_CLIENT_EMAIL: "firebase-adminsdk@test.iam.gserviceaccount.com",
    FCM_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
    FCM_MODE: "real",
    FCM_ALLOW_SIMULATION: "false",
    FCM_SIMULATION_MODE: "false",
  };

  it("resolves staging from THE_EYE_APP_ENV", () => {
    expect(resolveAppEnvironment({ THE_EYE_APP_ENV: "staging", FCM_PROJECT_ID: STAGING_FIREBASE_PROJECT_ID })).toBe(
      "staging",
    );
  });

  it("rejects production Firebase project in staging", () => {
    expectGuardFailure(
      () =>
        assertStagingFirebaseGuard({
          THE_EYE_APP_ENV: "staging",
          FCM_PROJECT_ID: PRODUCTION_FIREBASE_PROJECT_ID,
          FIREBASE_PROJECT_ID: PRODUCTION_FIREBASE_PROJECT_ID,
        }),
      "production Firebase project in staging",
    );
  });

  it("requires explicit staging Firebase project IDs", () => {
    expectGuardFailure(
      () =>
        assertStagingFirebaseGuard({
          THE_EYE_APP_ENV: "staging",
        }),
      "FCM_PROJECT_ID is required in staging",
    );
  });

  it("rejects staging Firebase project in production", () => {
    expectGuardFailure(
      () =>
        assertProductionFirebaseGuard({
          THE_EYE_APP_ENV: "production",
          FCM_PROJECT_ID: STAGING_FIREBASE_PROJECT_ID,
          ...productionCredentials,
        }),
      "staging or development Firebase project in production",
    );
  });

  it("rejects simulation in production", () => {
    expectGuardFailure(
      () =>
        assertProductionFirebaseGuard({
          THE_EYE_APP_ENV: "production",
          FCM_PROJECT_ID: PRODUCTION_FIREBASE_PROJECT_ID,
          ...productionCredentials,
          FCM_ALLOW_SIMULATION: "true",
        }),
      "FCM simulation must be disabled in production",
    );
  });

  it("rejects missing credentials in production", () => {
    expectGuardFailure(
      () =>
        assertProductionFirebaseGuard({
          THE_EYE_APP_ENV: "production",
          FCM_PROJECT_ID: PRODUCTION_FIREBASE_PROJECT_ID,
          FCM_MODE: "real",
        }),
      "FCM credentials are required in production",
    );
  });

  it("accepts service-account-json as a credential source", () => {
    const config = {
      THE_EYE_APP_ENV: "production",
      FCM_PROJECT_ID: PRODUCTION_FIREBASE_PROJECT_ID,
      FCM_MODE: "real",
      FCM_SERVICE_ACCOUNT_JSON: JSON.stringify({
        project_id: PRODUCTION_FIREBASE_PROJECT_ID,
        client_email: "firebase-adminsdk@test.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
      }),
    };
    expect(hasFcmCredentialSource(config)).toBe(true);
    expect(() => assertProductionFirebaseGuard(config)).not.toThrow();
  });
});
