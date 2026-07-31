import { AdminRoleName } from "@the-eye/shared";
import { WatchAlertTelemetryService } from "../watch-alert-telemetry.service";

describe("WatchAlertTelemetryService", () => {
  const superAdmin = {
    typ: "admin" as const,
    sub: "super",
    role: AdminRoleName.SuperAdmin,
    permissions: ["broadcast:publish"],
  };

  const countryAdmin = {
    typ: "admin" as const,
    sub: "country",
    role: AdminRoleName.CountryAdmin,
    country: "NG",
    permissions: ["broadcast:publish"],
  };

  function buildService(deliveries: unknown[]) {
    const prisma = {
      safetyAlertDelivery: {
        findMany: jest.fn().mockResolvedValue(deliveries),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    return new WatchAlertTelemetryService(prisma as any);
  }

  it("masks device and user identifiers in summary events", async () => {
    const service = buildService([
      {
        safetyAlertId: "alert-1",
        channel: "watch_push",
        status: "delivered",
        metadata: { telemetry: [{ event: "received", at: "2026-07-31T00:00:00.000Z" }] },
        safetyAlert: {
          metadata: { dangerAlertCode: "DANGER_ZONE_GENERAL_ENTRY", languageHint: "en-NG" },
          acknowledgements: [],
          dangerZone: { country: "NG", state: "Rivers", lga: "PHALGA", incidentId: "inc-1" },
        },
        recipient: {
          userId: "11111111-1111-1111-1111-111111111111",
          deviceId: "staging-watch-paired-001",
          device: {
            model: "Pixel Watch 2",
            batteryLevel: 88,
            connectivityMode: "PairedPhone",
            metadata: { accessibilityPreferences: { preferredSpokenLanguage: "en-NG" } },
          },
        },
      },
    ]);

    const summary = await service.summary(superAdmin);
    expect(summary.events[0]?.deviceId).toBe("stag…-001");
    expect(summary.events[0]?.userId).toBe("1111…1111");
    expect(summary.totals.received).toBe(1);
  });

  it("filters out-of-scope deliveries for country admins", async () => {
    const service = buildService([
      {
        safetyAlertId: "alert-ng",
        channel: "phone_relay",
        status: "delivered",
        metadata: { telemetry: [{ event: "relay_sent" }] },
        safetyAlert: {
          metadata: {},
          acknowledgements: [],
          dangerZone: { country: "NG", state: "Rivers", lga: "PHALGA", incidentId: "inc-ng" },
        },
        recipient: { userId: "u1", deviceId: "d1", device: { metadata: {} } },
      },
      {
        safetyAlertId: "alert-gh",
        channel: "phone_relay",
        status: "delivered",
        metadata: { telemetry: [{ event: "relay_sent" }] },
        safetyAlert: {
          metadata: {},
          acknowledgements: [],
          dangerZone: { country: "GH", state: "Greater Accra", lga: "Accra", incidentId: "inc-gh" },
        },
        recipient: { userId: "u2", deviceId: "d2", device: { metadata: {} } },
      },
    ]);

    const summary = await service.summary(countryAdmin);
    expect(summary.totals.deliveries).toBe(1);
    expect(summary.events[0]?.safetyAlertId).toBe("alert-ng");
  });
});
