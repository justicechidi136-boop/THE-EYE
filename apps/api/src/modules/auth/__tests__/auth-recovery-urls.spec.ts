import {
  AUTH_URL_ERROR_CODES,
  AuthRecoveryUrlError,
  assertStagingAuthLinkBases,
  buildAuthActionLink,
  validateAuthLinkBaseUrl,
} from "../auth-recovery-urls";

function expectAuthUrlError(fn: () => unknown, code: string) {
  try {
    fn();
    throw new Error(`Expected AuthRecoveryUrlError ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(AuthRecoveryUrlError);
    expect((error as AuthRecoveryUrlError).code).toBe(code);
  }
}

describe("AUTH-001/AUTH-006 auth recovery URL contract", () => {
  const stagingEnv = { THE_EYE_APP_ENV: "staging" };

  it("builds HTTPS reset URL on approved staging host with expected path", () => {
    const link = buildAuthActionLink(
      "https://staging-dashboard8jps.theeye.com.ng/reset-password",
      "opaque-token-value",
      "password_reset",
      stagingEnv,
    );
    const url = new URL(link);
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("staging-dashboard8jps.theeye.com.ng");
    expect(url.pathname).toBe("/reset-password");
    expect(url.searchParams.get("token")).toBe("opaque-token-value");
    expect(url.pathname).not.toBe("/login");
    expect(url.pathname).not.toBe("/dashboard");
    expect(link).not.toContain("localhost");
    expect(link).not.toContain("staging-app");
  });

  it("builds HTTPS recovery URL on approved staging host", () => {
    const link = buildAuthActionLink(
      "https://staging.theeye.com.ng/account-recovery",
      "recovery-token",
      "account_recovery",
      stagingEnv,
    );
    const url = new URL(link);
    expect(url.hostname).toBe("staging.theeye.com.ng");
    expect(url.pathname).toBe("/account-recovery");
    expect(url.searchParams.get("token")).toBe("recovery-token");
    expect(url.pathname).not.toBe("/login");
    expect(url.pathname).not.toBe("/dashboard");
  });

  it("builds a one-time operational account activation URL on the approved Admin origin", () => {
    const link = buildAuthActionLink(
      "https://staging-dashboard8jps.theeye.com.ng/activate-account",
      "invitation-token",
      "admin_invitation",
      stagingEnv,
    );
    const url = new URL(link);
    expect(url.pathname).toBe("/activate-account");
    expect(url.searchParams.get("token")).toBe("invitation-token");
  });

  it("rejects localhost and insecure schemes", () => {
    expectAuthUrlError(
      () =>
        validateAuthLinkBaseUrl("http://staging-dashboard8jps.theeye.com.ng/reset-password", "password_reset", {
          env: stagingEnv,
        }),
      AUTH_URL_ERROR_CODES.INSECURE_URL,
    );
    expectAuthUrlError(
      () =>
        validateAuthLinkBaseUrl("https://localhost/reset-password", "password_reset", {
          env: stagingEnv,
        }),
      AUTH_URL_ERROR_CODES.WRONG_ENVIRONMENT_HOST,
    );
  });

  it("rejects historical staging-app host (AUTH-URL-004)", () => {
    expectAuthUrlError(
      () =>
        validateAuthLinkBaseUrl("https://staging-app.theeye.com.ng/reset-password", "password_reset", {
          env: stagingEnv,
        }),
      AUTH_URL_ERROR_CODES.WRONG_ENVIRONMENT_HOST,
    );
  });

  it("rejects production host in staging and wrong paths", () => {
    expectAuthUrlError(
      () =>
        validateAuthLinkBaseUrl("https://theeye.com.ng/reset-password", "password_reset", {
          env: stagingEnv,
        }),
      AUTH_URL_ERROR_CODES.WRONG_ENVIRONMENT_HOST,
    );
    expectAuthUrlError(
      () =>
        validateAuthLinkBaseUrl("https://staging-dashboard8jps.theeye.com.ng/recover", "account_recovery", {
          env: stagingEnv,
        }),
      AUTH_URL_ERROR_CODES.INVALID_RECOVERY_BASE,
    );
    expectAuthUrlError(
      () =>
        validateAuthLinkBaseUrl("https://staging-dashboard8jps.theeye.com.ng/login", "password_reset", {
          env: stagingEnv,
        }),
      AUTH_URL_ERROR_CODES.INVALID_RESET_BASE,
    );
    expectAuthUrlError(
      () =>
        validateAuthLinkBaseUrl("https://staging-dashboard8jps.theeye.com.ng/dashboard", "account_recovery", {
          env: stagingEnv,
        }),
      AUTH_URL_ERROR_CODES.INVALID_RECOVERY_BASE,
    );
  });

  it("assertStagingAuthLinkBases accepts approved bases", () => {
    expect(() =>
      assertStagingAuthLinkBases({
        THE_EYE_APP_ENV: "staging",
        PASSWORD_RESET_LINK_BASE_URL: "https://staging-dashboard8jps.theeye.com.ng/reset-password",
        ACCOUNT_RECOVERY_LINK_BASE_URL: "https://staging-dashboard8jps.theeye.com.ng/account-recovery",
        ADMIN_INVITATION_LINK_BASE_URL: "https://staging-dashboard8jps.theeye.com.ng/activate-account",
      }),
    ).not.toThrow();
  });
});
