import { resolveWatchFeatureFlags, isWatchFeatureEnabled, inspectWatchFeatureFlags } from "../watch-feature-flags";

describe("watch feature flags", () => {
  it("defaults all production-safe flags on", () => {
    const flags = resolveWatchFeatureFlags({});
    expect(flags.WATCH_SPOKEN_DANGER_ALERTS).toBe(true);
    expect(flags.WATCH_PHONE_RELAY).toBe(true);
    expect(flags.WATCH_QUIET_HOURS).toBe(true);
    expect(flags.WATCH_ADMIN_TEST_ALERT).toBe(false);
  });

  it("disables staging test alerts in production", () => {
    const flags = resolveWatchFeatureFlags({
      THE_EYE_APP_ENV: "production",
      WATCH_ADMIN_TEST_ALERT: "1",
    });
    expect(flags.WATCH_ADMIN_TEST_ALERT).toBe(false);
  });

  it("enables staging test alerts in staging by default", () => {
    const flags = resolveWatchFeatureFlags({ THE_EYE_APP_ENV: "staging" });
    expect(flags.WATCH_ADMIN_TEST_ALERT).toBe(true);
  });

  it("parses explicit env overrides", () => {
    const flags = resolveWatchFeatureFlags({
      WATCH_PHONE_RELAY: "0",
      WATCH_HEADPHONE_PRIVACY: "false",
    });
    expect(flags.WATCH_PHONE_RELAY).toBe(false);
    expect(flags.WATCH_HEADPHONE_PRIVACY).toBe(false);
    expect(isWatchFeatureEnabled({ WATCH_PHONE_RELAY: "0" }, "WATCH_PHONE_RELAY")).toBe(false);
  });

  it("reports contradictory flag combinations", () => {
    const validation = inspectWatchFeatureFlags({
      WATCH_SPOKEN_DANGER_ALERTS: "0",
      WATCH_STANDALONE_ALERTS: "1",
    });
    expect(validation.valid).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "SPOKEN_OFF_DELIVERY_ON")).toBe(true);
  });

  it("includes admin telemetry flag by default", () => {
    const flags = resolveWatchFeatureFlags({});
    expect(flags.WATCH_ADMIN_TELEMETRY).toBe(true);
  });
});
