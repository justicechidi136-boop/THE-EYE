import {
  canRunWatchFleetBulkInline,
  canRunWatchFleetExportInline,
  resolveWatchFleetBulkMode,
} from "../watch-fleet-bulk-config";

describe("watch fleet bulk config", () => {
  it("defaults bulk mode to queue", () => {
    expect(resolveWatchFleetBulkMode({})).toBe("queue");
  });

  it("allows inline bulk only in development under device cap", () => {
    expect(
      canRunWatchFleetBulkInline(10, { WATCH_FLEET_BULK_MODE: "inline", THE_EYE_APP_ENV: "development" }),
    ).toBe(true);
    expect(
      canRunWatchFleetBulkInline(100, { WATCH_FLEET_BULK_MODE: "inline", THE_EYE_APP_ENV: "development" }),
    ).toBe(false);
  });

  it("disallows inline bulk in staging", () => {
    expect(
      canRunWatchFleetBulkInline(5, { WATCH_FLEET_BULK_MODE: "inline", THE_EYE_APP_ENV: "staging" }),
    ).toBe(false);
  });

  it("allows inline export only in development", () => {
    expect(canRunWatchFleetExportInline({ WATCH_FLEET_BULK_MODE: "inline", THE_EYE_APP_ENV: "development" })).toBe(true);
    expect(canRunWatchFleetExportInline({ WATCH_FLEET_BULK_MODE: "inline", THE_EYE_APP_ENV: "staging" })).toBe(false);
  });
});
