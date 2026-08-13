import {
  ADMIN_PRODUCT_HOSTS,
  assertNotAdminLoginDestination,
  buildCitizenAppReturnDeepLink,
  buildCitizenAppReturnHttpsPath,
  CITIZEN_APP_SCHEMES,
  resolveCitizenAppScheme,
} from "../citizen-app-return";
import {
  buildAuthActionLink,
  resolveAccountRecoveryBaseUrl,
  resolvePasswordResetBaseUrl,
} from "../auth-recovery-urls";

describe("AUTH-007 citizen app return", () => {
  it("staging scheme targets staging THE EYE mobile", () => {
    expect(
      resolveCitizenAppScheme({ THE_EYE_APP_ENV: "staging", NODE_ENV: "production" }),
    ).toBe(CITIZEN_APP_SCHEMES.staging);
  });

  it("production scheme targets production THE EYE mobile", () => {
    expect(
      resolveCitizenAppScheme({ THE_EYE_APP_ENV: "production", NODE_ENV: "production" }),
    ).toBe(CITIZEN_APP_SCHEMES.production);
  });

  it("explicit CITIZEN_APP_RETURN_SCHEME wins", () => {
    expect(
      resolveCitizenAppScheme({
        THE_EYE_APP_ENV: "production",
        CITIZEN_APP_RETURN_SCHEME: "theeye-staging",
      }),
    ).toBe("theeye-staging");
  });

  it("password-reset success deep link opens citizen sign-in without tokens", () => {
    const link = buildCitizenAppReturnDeepLink("PASSWORD_RESET_SUCCESS", {
      THE_EYE_APP_ENV: "staging",
    });
    const url = new URL(link);
    expect(url.protocol).toBe("theeye-staging:");
    expect(url.hostname).toBe("auth");
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("result")).toBe("PASSWORD_RESET_SUCCESS");
    expect(link.includes("token")).toBe(false);
    expect(link.includes("/admin")).toBe(false);
  });

  it("account-recovery success deep link opens citizen sign-in", () => {
    const link = buildCitizenAppReturnDeepLink("ACCOUNT_RECOVERY_SUCCESS", {
      THE_EYE_APP_ENV: "production",
    });
    expect(link.startsWith("theeye://auth/login")).toBe(true);
    expect(new URL(link).searchParams.get("result")).toBe("ACCOUNT_RECOVERY_SUCCESS");
  });

  it("HTTPS soft-landing never uses admin /login", () => {
    const path = buildCitizenAppReturnHttpsPath("PASSWORD_RESET_SUCCESS");
    expect(path.startsWith("/app/sign-in?")).toBe(true);
    expect(path.includes("/login")).toBe(false);
    assertNotAdminLoginDestination(path);
  });

  it("rejects admin login destinations", () => {
    expect(() => assertNotAdminLoginDestination("/login")).toThrow();
    expect(() =>
      assertNotAdminLoginDestination("https://staging-dashboard8jps.theeye.com.ng/login"),
    ).toThrow();
  });

  it("documents admin product hosts as forbidden return surfaces", () => {
    expect(ADMIN_PRODUCT_HOSTS.has("staging-dashboard8jps.theeye.com.ng")).toBe(true);
    expect(ADMIN_PRODUCT_HOSTS.has("dashboard.theeye.com.ng")).toBe(true);
  });

  it("citizen email form URLs use recovery paths, not admin login", () => {
    const env = {
      THE_EYE_APP_ENV: "staging",
      PASSWORD_RESET_LINK_BASE_URL:
        "https://staging-dashboard8jps.theeye.com.ng/reset-password",
      ACCOUNT_RECOVERY_LINK_BASE_URL:
        "https://staging-dashboard8jps.theeye.com.ng/account-recovery",
    };
    const reset = buildAuthActionLink(
      resolvePasswordResetBaseUrl(env),
      "opaque-reset-token",
      "password_reset",
      env,
    );
    const recovery = buildAuthActionLink(
      resolveAccountRecoveryBaseUrl(env),
      "opaque-recovery-token",
      "account_recovery",
      env,
    );
    expect(new URL(reset).pathname).toBe("/reset-password");
    expect(new URL(recovery).pathname).toBe("/account-recovery");
    expect(reset.includes("/login")).toBe(false);
    expect(recovery.includes("/login")).toBe(false);
  });

  it("staging email host must not be production admin", () => {
    const env = {
      THE_EYE_APP_ENV: "staging",
      PASSWORD_RESET_LINK_BASE_URL: "https://dashboard.theeye.com.ng/reset-password",
    };
    expect(() =>
      buildAuthActionLink(
        resolvePasswordResetBaseUrl(env),
        "token",
        "password_reset",
        env,
      ),
    ).toThrow();
  });
});
