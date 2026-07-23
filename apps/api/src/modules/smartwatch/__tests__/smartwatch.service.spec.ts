import { BadRequestException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { hashToken } from "../../../common/auth/crypto";
import { SmartwatchConnectivityMode, SmartwatchOfflineEventType, SmartwatchPairingMethod } from "@the-eye/shared";
import { SmartwatchService } from "../smartwatch.service";

function buildService(overrides: { config?: Record<string, string>; pairingSession?: any; firmwareRelease?: any } = {}) {
  const device = {
    id: "device-uuid",
    userId: "user-1",
    deviceId: "EYE-WATCH-001",
    deviceSecretHash: hashToken("watch-secret"),
    connectivityMode: "StandaloneCellular",
    preferredMode: "PairedPhone",
    failoverEnabled: true,
    isActive: true,
  };
  const pairingSession = overrides.pairingSession ?? {
    id: "session-1",
    deviceId: "EYE-WATCH-001",
    pairingCodeHash: hashToken("123456"),
    firebaseEnv: "staging",
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    deviceSecretPlain: null,
  };
  const prisma = {
    smartwatchDevice: {
      findFirst: jest.fn().mockResolvedValue(device),
      findUnique: jest.fn().mockResolvedValue(device),
      update: jest.fn().mockResolvedValue(device),
      upsert: jest.fn().mockResolvedValue(device),
      findMany: jest.fn(),
    },
    smartwatchPairingSession: {
      findUnique: jest.fn().mockResolvedValue(pairingSession),
      upsert: jest.fn().mockResolvedValue(pairingSession),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    sosEvent: {
      create: jest.fn().mockResolvedValue({ id: "sos-1", userId: "user-1", incidentId: "incident-1" }),
      update: jest.fn().mockResolvedValue({ id: "sos-1", familyNotifiedAt: new Date("2026-07-06T08:34:22.000Z") }),
      findMany: jest.fn(),
    },
    smartwatchGpsTrack: {
      create: jest.fn().mockResolvedValue({ id: "track-1" }),
    },
    emergencyContact: {
      findMany: jest.fn().mockResolvedValue([{ name: "Family", phone: "+2348000000000", priority: 1 }]),
    },
    incidentTimeline: { create: jest.fn().mockResolvedValue({ id: "timeline-1" }) },
    auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) },
    notification: { create: jest.fn() },
    smartwatchOfflineEvent: {
      create: jest.fn().mockImplementation(async (args: any) => ({ id: "offline-1", ...args.data })),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ id: "offline-1", status: "Processed" }),
    },
    smartwatchFirmwareRelease: {
      findFirst: jest.fn().mockResolvedValue(overrides.firmwareRelease ?? null),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  } as any;
  const incidents = {
    report: jest.fn().mockResolvedValue({ id: "incident-1", priority: "P1LifeThreatening", status: "Submitted" }),
  } as any;
  const notifications = {
    enqueue: jest.fn().mockResolvedValue({ jobId: "job-1" }),
    registerPushTokenForUser: jest.fn().mockResolvedValue({ data: { token: "fcm-token" } }),
    deactivatePushTokensForDevice: jest.fn().mockResolvedValue({ updated: 1 }),
    recordDeviceReceivedForUser: jest.fn().mockResolvedValue({ acknowledged: true }),
  } as any;
  const config = {
    get: jest.fn((key: string, fallback?: string) => overrides.config?.[key] ?? fallback ?? ""),
  } as any;
  const auditService = { record: jest.fn().mockResolvedValue({ id: "audit-1" }) } as any;
  return { service: new SmartwatchService(prisma, incidents, notifications, config, auditService), prisma, incidents, notifications, auditService, pairingSession };
}

describe("SmartwatchService", () => {
  it("creates a P1 incident and SOS event from standalone smartwatch SOS", async () => {
    const { service, prisma, incidents, notifications, auditService } = buildService();
    const result = await service.triggerSos({
      deviceId: "EYE-WATCH-001",
      deviceSecret: "watch-secret",
      latitude: 6.5244,
      longitude: 3.3792,
      accuracy: 8,
      sourceMode: SmartwatchConnectivityMode.StandaloneCellular,
    });

    expect(result.incident.id).toBe("incident-1");
    expect(incidents.report).toHaveBeenCalledWith(expect.objectContaining({
      type: "SOS",
      priority: "P1LifeThreatening",
      notifyEmergencyContacts: false,
    }), expect.objectContaining({ typ: "user", sub: "user-1" }));
    expect(prisma.sosEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sourceMode: "StandaloneCellular", incidentId: "incident-1" }),
    }));
    expect(prisma.smartwatchGpsTrack.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ latitude: 6.5244, longitude: 3.3792, sosEventId: "sos-1" }),
    }));
    expect(notifications.enqueue).toHaveBeenCalledWith(expect.objectContaining({ channel: "sms", sosEventId: "sos-1" }));
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({
      action: "sos.smartwatch_triggered",
    }));
  });

  it("fails over from paired mode to standalone when the phone is lost", async () => {
    const { service, prisma } = buildService();
    await service.heartbeat("EYE-WATCH-001", {
      deviceSecret: "watch-secret",
      pairedPhoneAvailable: false,
      internetAvailable: true,
      batteryLevel: 61,
      signalStrength: 72,
    });

    expect(prisma.smartwatchDevice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ connectivityMode: "StandaloneCellular", isOnline: true }),
    }));
  });

  it("issues a standalone device login token when certificate and secret are valid", async () => {
    const { service } = buildService();
    const result = await service.standaloneLogin({ deviceId: "EYE-WATCH-001", deviceSecret: "watch-secret" });
    expect(result.accessToken).toContain(".");
    expect(result.mode).toBe("StandaloneCellular");
  });

  it("registers a device when pairing code is valid", async () => {
    const { service, prisma } = buildService({ config: { FCM_PROJECT_ID: "the-eye-2stg" } });
    const result = await service.registerDevice({
      deviceId: "EYE-WATCH-001",
      provider: "THE EYE Mobile Pairing",
      pairingMethod: SmartwatchPairingMethod.PairingCode,
      pairingCode: "123456",
      firebaseEnv: "staging",
    }, { sub: "user-1", typ: "user", permissions: ["incident:create"] } as any);

    expect(Boolean(result.deviceSecret)).toBe(true);
    expect(prisma.smartwatchDevice.upsert).toHaveBeenCalled();
    expect(prisma.smartwatchPairingSession.updateMany).toHaveBeenCalled();
  });

  it("rejects expired pairing codes", async () => {
    const { service } = buildService({
      pairingSession: {
        id: "session-1",
        deviceId: "EYE-WATCH-001",
        pairingCodeHash: hashToken("123456"),
        firebaseEnv: "staging",
        expiresAt: new Date(Date.now() - 60_000),
        usedAt: null,
      },
    });

    await expect(service.registerDevice({
      deviceId: "EYE-WATCH-001",
      provider: "THE EYE Mobile Pairing",
      pairingMethod: SmartwatchPairingMethod.PairingCode,
      pairingCode: "123456",
      firebaseEnv: "staging",
    }, { sub: "user-1", typ: "user", permissions: ["incident:create"] } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects reused pairing codes", async () => {
    const { service } = buildService({
      pairingSession: {
        id: "session-1",
        deviceId: "EYE-WATCH-001",
        pairingCodeHash: hashToken("123456"),
        firebaseEnv: "staging",
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
      },
    });

    await expect(service.registerDevice({
      deviceId: "EYE-WATCH-001",
      provider: "THE EYE Mobile Pairing",
      pairingMethod: SmartwatchPairingMethod.PairingCode,
      pairingCode: "123456",
      firebaseEnv: "staging",
    }, { sub: "user-1", typ: "user", permissions: ["incident:create"] } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects wrong-environment pairing codes", async () => {
    const { service } = buildService({
      pairingSession: {
        id: "session-1",
        deviceId: "EYE-WATCH-001",
        pairingCodeHash: hashToken("123456"),
        firebaseEnv: "production",
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      },
    });

    await expect(service.registerDevice({
      deviceId: "EYE-WATCH-001",
      provider: "THE EYE Mobile Pairing",
      pairingMethod: SmartwatchPairingMethod.PairingCode,
      pairingCode: "123456",
      firebaseEnv: "staging",
    }, { sub: "user-1", typ: "user", permissions: ["incident:create"] } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns one-time device secret from pairing status", async () => {
    const { service, prisma } = buildService({
      pairingSession: {
        id: "session-1",
        deviceId: "EYE-WATCH-001",
        pairingCodeHash: hashToken("123456"),
        firebaseEnv: "staging",
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
        deviceSecretPlain: "secret-once",
      },
    });

    const first = await service.getPairingStatus("EYE-WATCH-001");
    expect(first.data.deviceSecret).toBe("secret-once");
    expect(prisma.smartwatchPairingSession.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { deviceSecretPlain: null },
    }));
  });

  it("replays uploaded offline SOS events after sync", async () => {
    const { service, prisma, incidents } = buildService();
    prisma.smartwatchOfflineEvent.findMany.mockResolvedValue([
      {
        id: "offline-1",
        eventType: "SOS",
        payload: {
          deviceId: "EYE-WATCH-001",
          deviceSecret: "watch-secret",
          latitude: 6.5244,
          longitude: 3.3792,
          metadata: { idempotencyKey: "offline-sos-1" },
        },
      },
    ]);

    await service.syncOfflineEvents("EYE-WATCH-001", {
      deviceId: "EYE-WATCH-001",
      deviceSecret: "watch-secret",
      events: [
        {
          eventType: SmartwatchOfflineEventType.GPS,
          occurredAt: new Date().toISOString(),
          payload: {
            deviceId: "EYE-WATCH-001",
            deviceSecret: "watch-secret",
            latitude: 6.5244,
            longitude: 3.3792,
          },
        },
      ],
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(incidents.report).toHaveBeenCalledWith(
      expect.objectContaining({ clientSubmissionId: "offline-sos-1" }),
      expect.objectContaining({ typ: "user" }),
    );
    expect(prisma.smartwatchOfflineEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "Processed" }),
    }));
  });

  it("registers push tokens with device credentials", async () => {
    const { service, notifications } = buildService({
      config: { THE_EYE_APP_ENV: "staging" },
    });

    const result = await service.registerDevicePushToken("EYE-WATCH-001", {
      deviceSecret: "watch-secret",
      token: "fcm-token-1",
      platform: "android_watch",
      appEnvironment: "staging",
    });

    expect(result.registered).toBe(true);
    expect(notifications.registerPushTokenForUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        token: "fcm-token-1",
        deviceId: "EYE-WATCH-001",
        platform: "android_watch",
      }),
    );
  });

  it("rejects push token registration for invalid device secret", async () => {
    const { service } = buildService();

    await expect(
      service.registerDevicePushToken("EYE-WATCH-001", {
        deviceSecret: "wrong-secret",
        token: "fcm-token-1",
        appEnvironment: "staging",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("acknowledges notifications for paired device users", async () => {
    const { service, notifications } = buildService();

    const result = await service.acknowledgeNotificationForDevice(
      "EYE-WATCH-001",
      "notification-1",
      { deviceSecret: "watch-secret", source: "watch_ack" },
    );

    expect(result.acknowledged).toBe(true);
    expect(notifications.recordDeviceReceivedForUser).toHaveBeenCalledWith(
      "user-1",
      "notification-1",
      "watch_ack",
    );
  });

  it("requires reason when admin revokes a device", async () => {
    const { service, prisma } = buildService();
    prisma.smartwatchDevice.findUnique.mockResolvedValue({
      id: "device-1",
      userId: "user-1",
      deviceId: "EYE-WATCH-001",
      user: { profile: { country: "NG", state: "LA", lga: "Ikeja" } },
    });
    await expect(
      service.revokeDevice("device-1", { sub: "admin-1", typ: "admin", role: "Super Admin" } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns version policy with semantic comparison", async () => {
    const { service, prisma } = buildService({
      firmwareRelease: {
        version: "0.2.0",
        minimumSupportedVersion: "0.1.0",
        downloadUrl: "https://cdn.example.com/watch.apk",
        fileHash: "abc",
        signature: "sig",
        status: "Published",
      },
    });

    const result = await service.versionPolicy(
      "EYE-WATCH-001",
      { deviceSecret: "watch-secret", currentVersion: "0.1.0", targetType: "watch" },
    );

    expect(result.data.updateStatus).toBe("UpdateRecommended");
    expect(result.data.downloadUrl).toMatch(/^https:\/\//);
    expect(prisma.smartwatchFirmwareRelease.findFirst).toHaveBeenCalled();
  });

  it("marks device lost with audit metadata", async () => {
    const { service, prisma } = buildService();
    const actor = { sub: "admin-1", typ: "admin", role: "Super Admin" } as any;

    prisma.smartwatchDevice.findUnique.mockResolvedValue({
      id: "device-1",
      userId: "user-1",
      deviceId: "EYE-WATCH-001",
      user: { profile: { country: "NG", state: "LA", lga: "Ikeja" } },
      metadata: {},
    });

    await service.adminDeviceAction("device-1", "mark-lost", { reason: "Reported missing" }, actor);

    expect(prisma.smartwatchDevice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ securityStatus: "Lost" }),
        }),
      }),
    );
  });

  function lostDevice(overrides: Record<string, unknown> = {}) {
    return {
      id: "device-uuid",
      userId: "user-1",
      deviceId: "EYE-WATCH-001",
      deviceSecretHash: hashToken("watch-secret"),
      connectivityMode: "StandaloneCellular",
      preferredMode: "PairedPhone",
      failoverEnabled: true,
      isActive: true,
      metadata: { securityStatus: "Lost", securityReason: "missing" },
      ...overrides,
    };
  }

  it("denies push token registration for lost devices", async () => {
    const { service, auditService } = buildService();
    const device = lostDevice();
    (service as any).prisma.smartwatchDevice.findFirst.mockResolvedValue(device);

    await expect(
      service.registerDevicePushToken("EYE-WATCH-001", {
        deviceSecret: "watch-secret",
        token: "fcm-token-1",
        appEnvironment: "staging",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "smartwatch.device_operation_denied" }),
    );
  });

  it("denies ordinary telemetry for stolen devices", async () => {
    const { service, auditService } = buildService();
    const device = lostDevice({ metadata: { securityStatus: "Stolen" } });
    (service as any).prisma.smartwatchDevice.findFirst.mockResolvedValue(device);

    await expect(
      service.heartbeat("EYE-WATCH-001", {
        deviceSecret: "watch-secret",
        batteryLevel: 50,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "smartwatch.device_operation_denied" }),
    );
  });

  it("denies pairing for lost devices without admin clearance", async () => {
    const { service, auditService, pairingSession } = buildService();
    const device = lostDevice();
    (service as any).prisma.smartwatchDevice.findUnique.mockResolvedValue(device);
    (service as any).prisma.smartwatchPairingSession.findUnique.mockResolvedValue(pairingSession);

    await expect(
      service.registerDevice({
        deviceId: "EYE-WATCH-001",
        provider: "THE EYE Mobile Pairing",
        pairingMethod: SmartwatchPairingMethod.PairingCode,
        pairingCode: "123456",
        firebaseEnv: "staging",
      }, { sub: "user-1", typ: "user", permissions: ["incident:create"] } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "smartwatch.device_operation_denied" }),
    );
  });

  it("allows emergency SOS for lost devices", async () => {
    const { service, incidents } = buildService();
    const device = lostDevice();
    (service as any).prisma.smartwatchDevice.findFirst.mockResolvedValue(device);

    const result = await service.triggerSos({
      deviceId: "EYE-WATCH-001",
      deviceSecret: "watch-secret",
      latitude: 6.5244,
      longitude: 3.3792,
    });

    expect(result.incident.id).toBe("incident-1");
    expect(incidents.report).toHaveBeenCalled();
  });

  it("restores ordinary operations after clear-security", async () => {
    const { service, notifications } = buildService();
    const device = lostDevice();
    (service as any).prisma.smartwatchDevice.findUnique.mockResolvedValue({
      ...device,
      user: { profile: { country: "NG", state: "LA", lga: "Ikeja" } },
    });
    (service as any).prisma.smartwatchDevice.update.mockResolvedValue({
      ...device,
      metadata: { securityClearedAt: new Date().toISOString() },
    });
    (service as any).prisma.smartwatchDevice.findFirst.mockResolvedValue({
      ...device,
      metadata: { securityClearedAt: new Date().toISOString() },
    });

    await service.adminDeviceAction(
      "device-uuid",
      "clear-security",
      {},
      { sub: "admin-1", typ: "admin", role: "Super Admin" } as any,
    );

    const result = await service.registerDevicePushToken("EYE-WATCH-001", {
      deviceSecret: "watch-secret",
      token: "fcm-token-1",
      appEnvironment: "development",
    });
    expect(result.registered).toBe(true);
    expect(notifications.registerPushTokenForUser).toHaveBeenCalled();
  });

  it("keeps revoked devices fully denied", async () => {
    const { service } = buildService();
    const device = lostDevice({ deviceSecretHash: null });
    (service as any).prisma.smartwatchDevice.findFirst.mockResolvedValue(device);

    await expect(
      service.triggerSos({
        deviceId: "EYE-WATCH-001",
        deviceSecret: "watch-secret",
        latitude: 1,
        longitude: 1,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("returns typed device settings and applies PATCH", async () => {
    const { service, prisma } = buildService();
    const device = {
      id: "device-uuid",
      userId: "user-1",
      deviceId: "EYE-WATCH-001",
      deviceSecretHash: hashToken("watch-secret"),
      displayName: "Citizen Watch",
      preferredMode: "PairedPhone",
      criticalAlertsEnabled: true,
      metadata: { deviceSettings: { sosCountdownSeconds: 4 } },
      isActive: true,
    };
    prisma.smartwatchDevice.findFirst.mockResolvedValue(device);
    prisma.smartwatchDevice.update.mockResolvedValue({
      ...device,
      metadata: {
        deviceSettings: {
          displayName: "Updated Watch",
          sosCountdownSeconds: 5,
          notificationCategories: ["EmergencyAlert"],
        },
      },
    });

    const current = await service.getDeviceSettings("EYE-WATCH-001", { deviceSecret: "watch-secret" });
    expect(current.data.sosCountdownSeconds).toBe(4);

    const patched = await service.patchDeviceSettings("EYE-WATCH-001", {
      deviceSecret: "watch-secret",
      displayName: "Updated Watch",
      sosCountdownSeconds: 5,
      notificationCategories: ["EmergencyAlert"],
    });
    expect(patched.data.displayName).toBe("Updated Watch");
    expect(patched.data.notificationCategories).toEqual(["EmergencyAlert"]);
  });
});
