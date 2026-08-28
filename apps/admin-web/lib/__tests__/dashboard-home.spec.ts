import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dashboardReporterLabel, dashboardReportType, formatDashboardTimestamp } from "../dashboard-presentation";
import type { Incident } from "../types/admin-views";

function incident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: "report-1",
    type: "Fire",
    title: "Market fire",
    description: "",
    priority: "P1",
    status: "Submitted",
    confidenceScore: 80,
    gps: { lat: 0, lng: 0, accuracy: "10m" },
    locationHistory: [],
    reporterStatus: "Ada Okafor",
    reporter: { label: "Ada Okafor", accountReference: "User abc", anonymous: false },
    reportingMode: "Identified",
    assignedAgency: "Unassigned",
    responseStatus: "Submitted",
    location: "Ikeja, Lagos",
    timeline: [],
    evidence: [],
    ...overrides,
  };
}

describe("Dashboard Home presentation", () => {
  it("uses authorized reporter identity and preserves anonymity", () => {
    expect(dashboardReporterLabel(incident())).toBe("Ada Okafor");
    expect(dashboardReporterLabel(incident({
      reporter: { label: "Anonymous reporter", accountReference: null, anonymous: true },
      reportingMode: "Anonymous",
    }))).toBe("Anonymous reporter");
  });

  it("formats report types and UTC timestamps for the Nigerian admin timezone", () => {
    expect(dashboardReportType("SUSPICIOUS_ACTIVITY")).toBe("Suspicious Activity");
    expect(dashboardReportType("SOS")).toBe("SOS");
    expect(formatDashboardTimestamp("2026-08-28T11:00:00.000Z")).toContain("12:00");
  });

  it("uses the active live-video contract and unified notification control", () => {
    const page = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");
    const data = readFileSync(join(process.cwd(), "lib", "api", "data.ts"), "utf8");
    const client = readFileSync(join(process.cwd(), "lib", "api", "client.ts"), "utf8");

    expect(page.includes('label="Total Reports"')).toBe(true);
    expect(page.includes('detail="Currently active live sessions"')).toBe(true);
    expect(page.includes("fetchNotificationUnreadCount()")).toBe(true);
    expect(page.includes("Open inbox")).toBe(false);
    expect(data.includes('"/live-video/sessions/active"')).toBe(true);
    expect(data.includes('"/notifications/unread-count"')).toBe(true);
    expect(client.includes('cache: "no-store"')).toBe(true);
  });
});
