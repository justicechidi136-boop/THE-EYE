import { assertStagingRecoveryLinkBases } from "../validate-env";
import { AUTH_URL_ERROR_CODES, AuthRecoveryUrlError } from "../../modules/auth/auth-recovery-urls";

function expectAuthUrlError(fn: () => unknown, code: string) {
  try {
    fn();
    throw new Error(`Expected AuthRecoveryUrlError ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(AuthRecoveryUrlError);
    expect((error as AuthRecoveryUrlError).code).toBe(code);
  }
}

describe("AUTH-001 staging recovery URL guards", () => {
  it("accepts HTTPS recovery and reset bases on approved staging hosts", () => {
    expect(() =>
      assertStagingRecoveryLinkBases({
        THE_EYE_APP_ENV: "staging",
        ACCOUNT_RECOVERY_LINK_BASE_URL:
          "https://staging-dashboard8jps.theeye.com.ng/account-recovery",
        PASSWORD_RESET_LINK_BASE_URL:
          "https://staging-dashboard8jps.theeye.com.ng/reset-password",
      }),
    ).not.toThrow();
  });

  it("rejects HTTP recovery bases in staging", () => {
    expectAuthUrlError(
      () =>
        assertStagingRecoveryLinkBases({
          THE_EYE_APP_ENV: "staging",
          ACCOUNT_RECOVERY_LINK_BASE_URL: "http://staging-dashboard8jps.theeye.com.ng/account-recovery",
        }),
      AUTH_URL_ERROR_CODES.INSECURE_URL,
    );
  });

  it("rejects staging-app host", () => {
    expectAuthUrlError(
      () =>
        assertStagingRecoveryLinkBases({
          THE_EYE_APP_ENV: "staging",
          PASSWORD_RESET_LINK_BASE_URL: "https://staging-app.theeye.com.ng/reset-password",
        }),
      AUTH_URL_ERROR_CODES.WRONG_ENVIRONMENT_HOST,
    );
  });
});
