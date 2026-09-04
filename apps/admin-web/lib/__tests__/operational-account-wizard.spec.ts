import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Operational account wizard", () => {
  it("implements the audited role-adaptive invitation workflow", () => {
    const source = readFileSync(join(process.cwd(), "components", "users", "operational-account-form.tsx"), "utf8");
    for (const step of ["Account type", "Organisation", "Operational scope", "Access & Scope", "Identity", "Authentication", "Review"]) {
      expect(source.includes(step)).toBe(true);
    }
    expect(source.includes("Result\"]")).toBe(false);
    for (const role of ["Field Officer", "Sub-State Admin", "State Admin", "Agency / Admin"]) {
      expect(source.includes(role)).toBe(true);
    }
    expect(source.includes("Initial password")).toBe(false);
    expect(source.includes("Staff ID")).toBe(false);
    expect(source.includes("Pending activation")).toBe(true);
    expect(source.includes("setCityId(\"\")")).toBe(true);
    expect(source.includes("setCommunityId(\"\")")).toBe(true);
  });
});
