import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("danger trigger dashboard visibility", () => {
  it("refreshes the existing incident dashboard while it is visible", () => {
    const dashboard = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");
    const refresh = readFileSync(
      join(process.cwd(), "components", "dashboard-live-refresh.tsx"),
      "utf8",
    );

    expect(dashboard.includes("<DashboardLiveRefresh />")).toBe(true);
    expect(refresh.includes("router.refresh()")).toBe(true);
    expect(refresh.includes('document.visibilityState === "visible"')).toBe(true);
    expect(refresh.includes("10_000")).toBe(true);
  });
});
