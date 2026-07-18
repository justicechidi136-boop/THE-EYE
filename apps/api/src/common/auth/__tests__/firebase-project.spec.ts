import { resolveFirebaseProjectId } from "../firebase-project";
import {
  DEVELOPMENT_FIREBASE_PROJECT_ID,
  STAGING_FIREBASE_PROJECT_ID,
} from "../firebase-project";

describe("resolveFirebaseProjectId", () => {
  it("prefers FIREBASE_PROJECT_ID when set", () => {
    expect(
      resolveFirebaseProjectId({
        get: (key: string) => (key === "FIREBASE_PROJECT_ID" ? STAGING_FIREBASE_PROJECT_ID : undefined),
      }),
    ).toBe(STAGING_FIREBASE_PROJECT_ID);
  });

  it("falls back to FCM_PROJECT_ID when FIREBASE_PROJECT_ID is unset", () => {
    expect(
      resolveFirebaseProjectId({
        get: (key: string) => (key === "FCM_PROJECT_ID" ? STAGING_FIREBASE_PROJECT_ID : undefined),
      }),
    ).toBe(STAGING_FIREBASE_PROJECT_ID);
  });

  it("falls back to service-account project_id when env vars are unset", () => {
    expect(
      resolveFirebaseProjectId({
        get: (key: string) => {
          if (key === "FCM_SERVICE_ACCOUNT_JSON") {
            return JSON.stringify({
              project_id: STAGING_FIREBASE_PROJECT_ID,
              client_email: "firebase-adminsdk@test.iam.gserviceaccount.com",
              private_key: "-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n",
            });
          }
          return undefined;
        },
      }),
    ).toBe(STAGING_FIREBASE_PROJECT_ID);
  });

  it("defaults to development when no project can be resolved", () => {
    expect(
      resolveFirebaseProjectId({
        get: () => undefined,
      }),
    ).toBe(DEVELOPMENT_FIREBASE_PROJECT_ID);
  });
});
