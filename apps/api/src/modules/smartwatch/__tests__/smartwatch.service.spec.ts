import { BadRequestException } from "@nestjs/common";
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
      notifyEmergencyContacts: true,
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
});
