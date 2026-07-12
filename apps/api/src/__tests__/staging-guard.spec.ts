import {
  assertStagingOnlySeedAllowed,
  detectProductionIndicators,
} from "../../prisma/staging-guard";
import { PRODUCTION_FIREBASE_PROJECT_ID, STAGING_FIREBASE_PROJECT_ID } from "../common/auth/firebase-project";

function expectGuardFailure(fn: () => void, messagePart: string) {
  try {
    fn();
    throw new Error(`Expected guard failure containing "${messagePart}"`);
  } catch (error) {
    if (error instanceof Error && error.message === `Expected guard failure containing "${messagePart}"`) throw error;
    expect(String(error)).toContain(messagePart);
  }
}

describe("staging guard", () => {
  it("allows staging when THE_EYE_APP_ENV is staging and Firebase is staging", () => {
    expect(() =>
      assertStagingOnlySeedAllowed({
        THE_EYE_APP_ENV: "staging",
        FCM_PROJECT_ID: STAGING_FIREBASE_PROJECT_ID,
        FIREBASE_PROJECT_ID: STAGING_FIREBASE_PROJECT_ID,
        DATABASE_URL: "postgresql://user:pass@staging-db.example.test:5432/the_eye_staging",
      }),
    ).not.toThrow();
  });

  it("rejects non-staging THE_EYE_APP_ENV", () => {
    expectGuardFailure(
      () =>
        assertStagingOnlySeedAllowed({
          THE_EYE_APP_ENV: "development",
          FCM_PROJECT_ID: STAGING_FIREBASE_PROJECT_ID,
        }),
      'THE_EYE_APP_ENV must be "staging"',
    );
  });

  it("rejects production Firebase project id", () => {
    expectGuardFailure(
      () =>
        assertStagingOnlySeedAllowed({
          THE_EYE_APP_ENV: "staging",
          FCM_PROJECT_ID: PRODUCTION_FIREBASE_PROJECT_ID,
        }),
      "production indicators detected",
    );
  });

  it("rejects production database url patterns", () => {
    const indicators = detectProductionIndicators({
      DATABASE_URL: "postgresql://user:pass@db.the-eye-2pd.internal:5432/the_eye",
    });
    expect(indicators.length).toBeGreaterThan(0);
  });

  it("rejects mismatched staging firebase project when explicitly set", () => {
    expectGuardFailure(
      () =>
        assertStagingOnlySeedAllowed({
          THE_EYE_APP_ENV: "staging",
          FCM_PROJECT_ID: "the-eye-29cff",
        }),
      "FCM_PROJECT_ID must be",
    );
  });
});
