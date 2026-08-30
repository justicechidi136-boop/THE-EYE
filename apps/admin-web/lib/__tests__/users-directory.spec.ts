import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Users directory", () => {
  it("uses the authoritative lifecycle workspace from the approved reference", () => {
    const root = join(process.cwd());
    const page = readFileSync(join(root, "app", "users", "page.tsx"), "utf8");
    const filters = readFileSync(join(root, "components", "users", "user-directory-filters.tsx"), "utf8");

    expect(page.includes("Total Users")).toBe(true);
    expect(page.includes("Active Users")).toBe(true);
    expect(page.includes("Pending Users")).toBe(true);
    expect(page.includes("Deactivated Users")).toBe(true);
    expect(page.includes("Admins in page")).toBe(false);
    expect(page.includes("More pages")).toBe(false);
    expect(page.includes("Detailed table")).toBe(false);
    expect(page.includes('aria-label="User directory pages"')).toBe(true);
    expect(filters.includes("Search by name, email, phone or user ID")).toBe(true);
    expect(filters.includes("All communities")).toBe(true);
    expect(filters.includes('["state", "lga", "communityId"]')).toBe(true);
  });
});
