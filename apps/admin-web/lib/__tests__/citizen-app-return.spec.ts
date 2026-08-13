import {
  assertNotAdminLoginDestination,
  buildCitizenAppReturnDeepLink,
  buildCitizenAppReturnHttpsPath,
  citizenReturnCopy,
  resolveCitizenAppScheme,
} from "../citizen-app-return";

function expectThrows(fn: () => void): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  expect(threw).toBe(true);
}

describe("AUTH-007 admin-web citizen return helpers", () => {
  it("staging env resolves staging scheme", () => {
    const previousScheme = process.env.NEXT_PUBLIC_CITIZEN_APP_RETURN_SCHEME;
    const previousEnv = process.env.NEXT_PUBLIC_THE_EYE_APP_ENV;
    delete process.env.NEXT_PUBLIC_CITIZEN_APP_RETURN_SCHEME;
    process.env.NEXT_PUBLIC_THE_EYE_APP_ENV = "staging";
    expect(resolveCitizenAppScheme()).toBe("theeye-staging");
    if (previousScheme === undefined) delete process.env.NEXT_PUBLIC_CITIZEN_APP_RETURN_SCHEME;
    else process.env.NEXT_PUBLIC_CITIZEN_APP_RETURN_SCHEME = previousScheme;
    if (previousEnv === undefined) delete process.env.NEXT_PUBLIC_THE_EYE_APP_ENV;
    else process.env.NEXT_PUBLIC_THE_EYE_APP_ENV = previousEnv;
  });

  it("production env resolves production scheme", () => {
    const previousScheme = process.env.NEXT_PUBLIC_CITIZEN_APP_RETURN_SCHEME;
    const previousEnv = process.env.NEXT_PUBLIC_THE_EYE_APP_ENV;
    delete process.env.NEXT_PUBLIC_CITIZEN_APP_RETURN_SCHEME;
    process.env.NEXT_PUBLIC_THE_EYE_APP_ENV = "production";
    expect(resolveCitizenAppScheme()).toBe("theeye");
    if (previousScheme === undefined) delete process.env.NEXT_PUBLIC_CITIZEN_APP_RETURN_SCHEME;
    else process.env.NEXT_PUBLIC_CITIZEN_APP_RETURN_SCHEME = previousScheme;
    if (previousEnv === undefined) delete process.env.NEXT_PUBLIC_THE_EYE_APP_ENV;
    else process.env.NEXT_PUBLIC_THE_EYE_APP_ENV = previousEnv;
  });

  it("password-reset success CTA copy matches AUTH-007 UX", () => {
    const copy = citizenReturnCopy("PASSWORD_RESET_SUCCESS");
    expect(copy.title).toBe("PASSWORD UPDATED");
    expect(copy.body).toContain("changed successfully");
  });

  it("account-recovery success CTA copy matches AUTH-007 UX", () => {
    const copy = citizenReturnCopy("ACCOUNT_RECOVERY_SUCCESS");
    expect(copy.title).toBe("ACCOUNT RECOVERED");
    expect(copy.body).toContain("Return to THE EYE");
  });

  it("deep link never targets admin login", () => {
    const previousScheme = process.env.NEXT_PUBLIC_CITIZEN_APP_RETURN_SCHEME;
    const previousEnv = process.env.NEXT_PUBLIC_THE_EYE_APP_ENV;
    delete process.env.NEXT_PUBLIC_CITIZEN_APP_RETURN_SCHEME;
    process.env.NEXT_PUBLIC_THE_EYE_APP_ENV = "staging";
    const link = buildCitizenAppReturnDeepLink("PASSWORD_RESET_SUCCESS");
    expect(link.startsWith("theeye-staging://auth/login")).toBe(true);
    expect(link.includes("token=")).toBe(false);
    assertNotAdminLoginDestination(link);
    if (previousScheme === undefined) delete process.env.NEXT_PUBLIC_CITIZEN_APP_RETURN_SCHEME;
    else process.env.NEXT_PUBLIC_CITIZEN_APP_RETURN_SCHEME = previousScheme;
    if (previousEnv === undefined) delete process.env.NEXT_PUBLIC_THE_EYE_APP_ENV;
    else process.env.NEXT_PUBLIC_THE_EYE_APP_ENV = previousEnv;
  });

  it("https soft landing is /app/sign-in not /login", () => {
    const path = buildCitizenAppReturnHttpsPath("ACCOUNT_RECOVERY_SUCCESS");
    expect(path.startsWith("/app/sign-in")).toBe(true);
    expect(path.includes("/login")).toBe(false);
  });

  it("rejects admin login destinations", () => {
    expectThrows(() => assertNotAdminLoginDestination("/login"));
    expectThrows(() =>
      assertNotAdminLoginDestination("https://dashboard.theeye.com.ng/login"),
    );
  });
});
