import { BadRequestException } from "@nestjs/common";
import { AdminRoleName } from "@the-eye/shared";
import { hashToken } from "../../../common/auth/crypto";
import { SmartwatchConnectivityMode, SmartwatchPairingMethod } from "@the-eye/shared";
import { SmartwatchService } from "../smartwatch.service";

function buildService(overrides: { config?: Record<string, string>; pairingSession?: any } = {}) {
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
  } as any;
  const incidents = {
    report: jest.fn().mockResolvedValue({ id: "incident-1", priority: "P1LifeThreatening", status: "Submitted" }),
  } as any;
  const notifications = {
    enqueue: jest.fn().mockResolvedValue({ jobId: "job-1" }),
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
          eventType: "GPS",
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

  it("issues activation secret and records audit log", async () => {
    const { service, prisma, auditService } = buildService();
    prisma.smartwatchPairingSession.upsert = jest.fn().mockResolvedValue({ id: "session-1", deviceId: "EYE-WATCH-NEW" });
    const actor = { typ: "admin", sub: "admin-1", role: AdminRoleName.SuperAdmin } as any;

    const result = await service.adminIssueActivation({ deviceId: "EYE-WATCH-NEW", ttlMinutes: 10 }, actor);

    expect(result.data.deviceId).toBe("EYE-WATCH-NEW");
    expect(result.data.pairingCode).toMatch(/^\d{6}$/);
    expect(result.data.qrPayload).toContain("the-eye-smartwatch-activation");
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({
      action: "smartwatch.activation_secret_issued",
    }));
  });

  it("revokes pairing session and records audit log", async () => {
    const { service, prisma, auditService } = buildService();
    prisma.smartwatchPairingSession.findUnique = jest.fn().mockResolvedValue({ id: "session-1", deviceId: "EYE-WATCH-001" });
    prisma.smartwatchPairingSession.delete = jest.fn().mockResolvedValue({ id: "session-1" });
    const actor = { typ: "admin", sub: "admin-1", role: AdminRoleName.SuperAdmin } as any;

    const result = await service.adminRevokePairingSession("EYE-WATCH-001", actor);

    expect(result).toEqual({ revoked: true, deviceId: "EYE-WATCH-001" });
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({
      action: "smartwatch.activation_secret_revoked",
    }));
  });

  it("returns device detail for admin lookup by public device id", async () => {
    const { service, prisma } = buildService();
    prisma.smartwatchDevice.findFirst = jest.fn().mockResolvedValue({
      id: "device-uuid",
      deviceId: "EYE-WATCH-001",
      user: { profile: { country: "NG", state: "LA", lga: "Ikeja" } },
      sosEvents: [],
      gpsTracks: [],
      firmwareUpdates: [],
    });
    const actor = { typ: "admin", sub: "admin-1", role: AdminRoleName.SuperAdmin } as any;

    const result = await service.adminGetDevice("EYE-WATCH-001", actor);

    expect(result.data.deviceId).toBe("EYE-WATCH-001");
    expect(prisma.smartwatchDevice.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ id: "EYE-WATCH-001" }, { deviceId: "EYE-WATCH-001" }] },
    }));
  });

  it("activates standalone watch with admin pairing code", async () => {
    const { service, prisma, auditService } = buildService({
      config: { JWT_ACCESS_SECRET: "test-secret-key-for-jwt-signing", FCM_PROJECT_ID: "the-eye-2stg" },
    });
    prisma.smartwatchPairingSession.update = jest.fn().mockResolvedValue({});

    const result = await service.activateWithCode({
      deviceId: "EYE-WATCH-001",
      pairingCode: "123456",
      firebaseEnv: "staging",
    });

    expect(result.status).toBe("activated");
    expect(result.watch.deviceId).toBe("EYE-WATCH-001");
    expect(result.authentication.accessToken).toContain(".");
    expect(result.deviceSecret).toBeTruthy();
    expect(prisma.smartwatchDevice.upsert).toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({
      action: "smartwatch.device_activated_with_code",
    }));
  });

  it("recovers incomplete activation when session secret is still available", async () => {
    const { service, auditService } = buildService({
      config: { JWT_ACCESS_SECRET: "test-secret-key-for-jwt-signing", FCM_PROJECT_ID: "the-eye-2stg" },
      pairingSession: {
        id: "session-1",
        deviceId: "EYE-WATCH-001",
        pairingCodeHash: hashToken("123456"),
        firebaseEnv: "staging",
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
        deviceSecretPlain: "recovery-secret",
      },
    });

    const result = await service.activateWithCode({
      deviceId: "EYE-WATCH-001",
      pairingCode: "123456",
      firebaseEnv: "staging",
    });

    expect(result.status).toBe("activated");
    expect((result as { recovery?: boolean }).recovery).toBe(true);
    expect(result.deviceSecret).toBe("recovery-secret");
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({
      action: "smartwatch.device_activation_recovery",
    }));
  });

  it("rejects invalid admin activation codes", async () => {
    const { service } = buildService({
      pairingSession: {
        id: "session-1",
        deviceId: "EYE-WATCH-001",
        pairingCodeHash: hashToken("123456"),
        firebaseEnv: "staging",
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        deviceSecretPlain: null,
      },
    });

    await expect(service.activateWithCode({
      deviceId: "EYE-WATCH-001",
      pairingCode: "654321",
      firebaseEnv: "staging",
    })).rejects.toMatchObject({ status: 401 });
  });
});
