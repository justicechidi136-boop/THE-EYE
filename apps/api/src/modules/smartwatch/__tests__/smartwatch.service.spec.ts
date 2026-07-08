import { hashToken } from "../../../common/auth/crypto";
import { SmartwatchService } from "../smartwatch.service";

function buildService() {
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
  const prisma = {
    smartwatchDevice: {
      findFirst: jest.fn().mockResolvedValue(device),
      findUnique: jest.fn().mockResolvedValue(device),
      update: jest.fn().mockResolvedValue(device),
      upsert: jest.fn(),
      findMany: jest.fn(),
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
  const config = { get: jest.fn((_key: string, fallback: string) => fallback) } as any;
  return { service: new SmartwatchService(prisma, incidents, notifications, config), prisma, incidents, notifications };
}

describe("SmartwatchService", () => {
  it("creates a P1 incident and SOS event from standalone smartwatch SOS", async () => {
    const { service, prisma, incidents, notifications } = buildService();
    const result = await service.triggerSos({
      deviceId: "EYE-WATCH-001",
      deviceSecret: "watch-secret",
      latitude: 6.5244,
      longitude: 3.3792,
      accuracy: 8,
      sourceMode: "StandaloneCellular",
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
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "sos.smartwatch_triggered" }),
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
});
