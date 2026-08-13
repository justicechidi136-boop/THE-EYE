import { readFileSync } from "fs";
import { resolve } from "path";

function readAppFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("AUTH-007 citizen recovery/reset routing", () => {
  it("reset-password page never links citizens to admin login", () => {
    const source = readAppFile("app/reset-password/page.tsx");

    expect(source.includes('href="/login"')).toBe(false);
    expect(source.includes('Link href="/login"')).toBe(false);
    expect(source.includes("CitizenReturnToApp")).toBe(true);
    expect(source.includes("PASSWORD_RESET_SUCCESS")).toBe(true);
    expect(source.includes("Admin Dashboard")).toBe(true);
  });

  it("account-recovery page never links citizens to admin login", () => {
    const source = readAppFile("app/account-recovery/page.tsx");

    expect(source.includes('href="/login"')).toBe(false);
    expect(source.includes('Link href="/login"')).toBe(false);
    expect(source.includes("CitizenReturnToApp")).toBe(true);
    expect(source.includes("ACCOUNT_RECOVERY_SUCCESS")).toBe(true);
  });

  it("Return to THE EYE component uses custom scheme only", () => {
    const source = readAppFile("components/citizen-return-to-app.tsx");

    expect(source.includes("Return to THE EYE")).toBe(true);
    expect(source.includes("buildCitizenAppReturnDeepLink")).toBe(true);
    expect(source.includes('href="/login"')).toBe(false);
    expect(source.includes("Admin Dashboard")).toBe(true);
    expect(source.includes('data-admin-login="false"')).toBe(true);
  });

  it("soft-landing /app/sign-in never redirects to admin login", () => {
    const source = readAppFile("app/app/sign-in/page.tsx");

    expect(source.includes("buildCitizenAppReturnDeepLink")).toBe(true);
    expect(source.includes('href="/login"')).toBe(false);
    expect(source.includes("never Admin")).toBe(true);
  });

  it("middleware keeps citizen recovery paths public and admin login intact", () => {
    const source = readAppFile("middleware.ts");

    expect(source.includes('"/reset-password"')).toBe(true);
    expect(source.includes('"/account-recovery"')).toBe(true);
    expect(source.includes('"/app/sign-in"')).toBe(true);
    expect(source.includes('"/sign-in"')).toBe(true);
    expect(source.includes('pathname = "/login"')).toBe(true);
  });

  it("admin login page remains available for admin product", () => {
    const source = readAppFile("app/login/page.tsx");
    expect(source.length > 50).toBe(true);
    expect(source.toLowerCase().includes("login") || source.toLowerCase().includes("sign")).toBe(
      true,
    );
  });
});
