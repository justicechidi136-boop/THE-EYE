import { ConfigService } from "@nestjs/config";
import { WatchDangerAlertDeliveryService } from "../watch-danger-alert-delivery.service";
import { WatchAlertTelemetryService } from "../watch-alert-telemetry.service";
import { NotificationsService } from "../../notifications/notifications.service";

describe("WatchDangerAlertDeliveryService", () => {
  const dangerAlert = {
    schemaVersion: 1,
    type: "DANGER_ZONE_ALERT",
    alertId: "alert-1",
    version: 1,
    sequence: 1,
    state: "Critical",
    alertCode: "DANGER_ZONE_GENERAL_ENTRY",
    priority: "CRITICAL",
    incidentId: "inc-1",
    zoneId: "zone-1",
    safetyAlertId: "safe-1",
    issuedAt: new Date().toISOString(),
    acknowledgementRequired: true,
    repeatCount: 1,
  } as any;

  function buildService(config: Record<string, unknown>) {
    const prisma = {
      smartwatchDevice: {
        findUnique: jest.fn().mockResolvedValue({
          id: "device-1",
          deviceId: "staging-watch-paired-001",
          connectivityMode: "PairedPhone",
        }),
      },
    };
    const notifications = {
      create: jest.fn().mockResolvedValue({ data: [{ id: "notif-1" }] }),
    };
    const telemetry = {
      record: jest.fn().mockResolvedValue({ recorded: true }),
    };
    const configService = {
      get: (key: string) => config[key],
    } as unknown as ConfigService;

    return {
      service: new WatchDangerAlertDeliveryService(
        prisma as any,
        notifications as unknown as NotificationsService,
        configService,
        telemetry as unknown as WatchAlertTelemetryService,
      ),
      notifications,
      telemetry,
    };
  }

  const basePayload = {
    safetyAlertId: "safe-1",
    userId: "user-1",
    deviceId: "device-1",
    dangerZoneId: "zone-1",
    incidentId: "inc-1",
    idempotencyKey: "key-1",
    dangerAlert,
    title: "Test",
    body: "Body",
    actorAdminId: "admin-1",
  };

  it("respects phone_relay channel override", async () => {
    const { service, notifications } = buildService({});
    const result = await service.dispatchNow({ ...basePayload, channelMode: "phone_relay" });

    expect(result.dispatched).toBe(1);
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create.mock.calls[0][0].channels).toEqual(["push", "in_app"]);
  });

  it("respects watch_push channel override", async () => {
    const { service, notifications } = buildService({});
    const result = await service.dispatchNow({ ...basePayload, channelMode: "watch_push" });

    expect(result.dispatched).toBe(1);
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create.mock.calls[0][0].channels).toEqual(["watch_push"]);
  });

  it("skips delivery when all watch alert flags are disabled", async () => {
    const { service } = buildService({
      WATCH_SPOKEN_DANGER_ALERTS: "0",
      WATCH_STANDALONE_ALERTS: "0",
      WATCH_PHONE_RELAY: "0",
    });

    const result = await service.enqueueDelivery(basePayload);
    expect(result).toEqual({ queued: false, reason: "watch_alerts_disabled" });
  });
});
