import {
  encodeCursorHistory,
  formatReportCapturedAt,
  parseCursorHistory,
  reportReporterLabel,
  reportTypeLabel,
  REPORT_TYPE_OPTIONS,
} from "../report-centre-presentation";
import type { Incident } from "../types/admin-views";
import { clusterReportMapPoints } from "../report-map-clustering";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Report Centre presentation", () => {
  it("exposes only approved report types", () => {
    expect(REPORT_TYPE_OPTIONS.map((option) => option.label)).toEqual([
      "Emergency", "Crime", "Accident", "Fire", "Kidnapping", "Abuse", "Suspicious Activity", "SOS",
    ]);
  });

  it("formats reporter privacy and report labels", () => {
    const report = { reporter: { anonymous: true, label: "Hidden" } } as Incident;
    expect(reportReporterLabel(report)).toBe("Anonymous");
    expect(reportTypeLabel("SuspiciousActivity")).toBe("Suspicious Activity");
  });

  it("round-trips cursor history without exposing cursors in page labels", () => {
    const history = ["first", "opaque-cursor"];
    expect(parseCursorHistory(encodeCursorHistory(history))).toEqual(history);
    expect(parseCursorHistory("invalid")).toEqual([]);
  });

  it("renders a human-readable Lagos timestamp", () => {
    expect(formatReportCapturedAt("2026-08-28T10:00:00.000Z")).toContain("2026");
  });

  it("clusters same-location and nearby reports while leaving distant reports visible", () => {
    const reports = [{ id: "a" }, { id: "b" }, { id: "c" }] as Incident[];
    const clusters = clusterReportMapPoints([
      { report: reports[0], x: 100, y: 100 },
      { report: reports[1], x: 100, y: 100 },
      { report: reports[2], x: 300, y: 300 },
    ]);
    expect(clusters.map((cluster) => cluster.reports.length)).toEqual([2, 1]);
  });

  it("splits nearby reports after zoom increases their screen distance", () => {
    const reports = [{ id: "a" }, { id: "b" }] as Incident[];
    expect(clusterReportMapPoints([
      { report: reports[0], x: 100, y: 100 },
      { report: reports[1], x: 130, y: 100 },
    ]).length).toBe(1);
    expect(clusterReportMapPoints([
      { report: reports[0], x: 100, y: 100 },
      { report: reports[1], x: 180, y: 100 },
    ]).length).toBe(2);
  });

  it("keeps the synchronized active-report rail beside the live map", () => {
    const source = readFileSync(join(process.cwd(), "components", "report-centre-map.tsx"), "utf8");
    expect(source.includes("Active reports (")).toBe(true);
    expect(source.includes("View all reports")).toBe(true);
    expect(source.includes("setSelectedId(report.id)")).toBe(true);
  });
});
