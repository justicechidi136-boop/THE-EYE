import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("field device management", () => {
  it("uses a scoped officer selector instead of raw database identifiers", () => {
    const source = readFileSync(
      join(process.cwd(), "components", "field-operations", "field-device-preprovision-wizard.tsx"),
      "utf8",
    );
    expect(source.includes("Assigned officer user ID")).toBe(false);
    expect(source.includes("/api/admin/field-devices/assignable-users")).toBe(true);
    expect(source.includes("Assign later")).toBe(true);
    expect(source.includes("assignedUserId: values.assignedUserId.trim() || undefined")).toBe(true);
  });

  it("keeps entered values in component state when creation returns an error", () => {
    const source = readFileSync(
      join(process.cwd(), "components", "field-operations", "field-device-preprovision-wizard.tsx"),
      "utf8",
    );
    expect(source.includes("setSubmitError(")).toBe(true);
    expect(source.includes("setValues(DEFAULT_VALUES)")).toBe(false);
  });

  it("offers a simple one-time supervisor token flow with server expiry", () => {
    const source = readFileSync(
      join(process.cwd(), "components", "field-operations", "field-device-pairing-panel.tsx"),
      "utf8",
    );
    expect(source.includes("Generate supervisor token")).toBe(true);
    expect(source.includes("Supervisor token generated successfully.")).toBe(true);
    expect(source.includes("Copy this token now.")).toBe(true);
    expect(source.includes("ttlMinutes")).toBe(false);
    expect(source.includes("navigator.clipboard.writeText(pairing.shortCode)")).toBe(true);
    expect(source.includes("The current token will stop working.")).toBe(true);
  });
});
