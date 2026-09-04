import {
  encodeCursorHistory,
  formatReportCapturedAt,
  parseCursorHistory,
  relativeReportTime,
  reportPaginationItems,
  reportReporterLabel,
  reportTypeLabel,
  REPORT_TYPE_OPTIONS,
} from "../report-centre-presentation";
import type { Incident } from "../types/admin-views";
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

  it("formats relative marker times", () => {
    const now = Date.parse("2026-09-04T12:00:00.000Z");
    expect(relativeReportTime("2026-09-04T11:48:00.000Z", now)).toBe("12 mins ago");
  });

  it("builds compact numbered pagination", () => {
    expect(reportPaginationItems(1, 13)).toEqual([1, 2, "ellipsis", 13]);
    expect(reportPaginationItems(7, 13)).toEqual([1, "ellipsis", 6, 7, 8, "ellipsis", 13]);
  });

  it("uses an interactive clustered map without the duplicate Active Reports rail", () => {
    const source = readFileSync(join(process.cwd(), "components", "report-centre-map.tsx"), "utf8");
    expect(source).toContain("markerClusterGroup");
    expect(source).toContain('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(source.includes("{s}.tile.openstreetmap.org")).toBe(false);
    expect(source).toContain("zoomToBoundsOnClick: true");
    expect(source).toContain("keepInView: true");
    expect(source).toContain("View Report");
    expect(source.includes("Active reports (")).toBe(false);

    const styles = readFileSync(join(process.cwd(), "app", "styles.css"), "utf8");
    expect(styles).toContain("calc(100vw - 150px)");
    expect(styles).toContain("@media (max-width: 1023px)");
  });
});
