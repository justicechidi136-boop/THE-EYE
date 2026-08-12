import { readFileSync } from "fs";
import { resolve } from "path";

function readAppFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("AUTH-007 citizen recovery/reset routing", () => {
  it("reset-password page never links citizens to admin login", () => {
    const source = readAppFile("app/reset-password/page.tsx");

    expect(source.includes('href="/login"')).toBe(false);
    expect(source.includes("Link href=\"/login\"")).toBe(false);
    expect(source.includes("Your password has been reset successfully.")).toBe(true);
    expect(source.includes("Return to the THE EYE app and sign in with your new password.")).toBe(
      true,
    );
  });

  it("account-recovery page never links citizens to admin login", () => {
    const source = readAppFile("app/account-recovery/page.tsx");

    expect(source.includes('href="/login"')).toBe(false);
    expect(source.includes("Link href=\"/login\"")).toBe(false);
    expect(source.includes("Return to the THE EYE app and continue account recovery")).toBe(true);
  });
});
