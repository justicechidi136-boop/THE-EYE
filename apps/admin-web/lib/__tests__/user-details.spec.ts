import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("User Details", () => {
  it("implements the approved operational account workspace", () => {
    const root = join(process.cwd());
    const page = readFileSync(join(root, "app", "users", "[id]", "page.tsx"), "utf8");
    const actions = readFileSync(join(root, "components", "users", "user-account-actions.tsx"), "utf8");

    for (const section of ["Account overview", "Jurisdiction and scope", "KYC history", "Emergency contacts", "Activity feed", "Reports", "Broadcasts", "Sightings", "Account history"]) {
      expect(page.includes(section)).toBe(true);
    }
    expect(page.includes("No KYC submissions")).toBe(true);
    expect(page.includes("No emergency contacts added.")).toBe(true);
    expect(page.includes("Not assigned")).toBe(true);
    expect(page.includes("humanPriorityLabel(report.priority)")).toBe(true);
    expect(page.includes("/incidents/")).toBe(true);
    expect(page.includes("/broadcasts/")).toBe(true);
    expect(actions.includes('role="dialog"')).toBe(true);
    expect(actions.includes("Reason")).toBe(true);
    expect(actions.includes("router.refresh()")).toBe(true);
    expect(actions.includes("Suspend")).toBe(true);
    expect(actions.includes("Reactivate")).toBe(true);
    expect(actions.includes("Change role")).toBe(false);
  });
});
