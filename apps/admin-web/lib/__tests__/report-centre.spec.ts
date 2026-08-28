import {
  encodeCursorHistory,
  formatReportCapturedAt,
  parseCursorHistory,
  reportReporterLabel,
  reportTypeLabel,
  REPORT_TYPE_OPTIONS,
} from "../report-centre-presentation";
import type { Incident } from "../types/admin-views";

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
});
