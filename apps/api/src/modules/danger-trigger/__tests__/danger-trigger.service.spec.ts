import { DangerTriggerService } from "../danger-trigger.service";

const actor = {
  typ: "user",
  sub: "11111111-1111-4111-8111-111111111111",
  role: "Citizen",
  permissions: ["incident:create", "incident:read"],
} as any;

function buildService() {
  const claimedDeliveries = new Set<string>();
  const event = {
    id: "event-1",
    incidentId: "incident-1",
    initiatorUserId: actor.sub,
    sourceType: "LIVE_VOICE",
    state: "POTENTIAL",
    severity: "CRITICAL",
    latitude: 6.5244,
    longitude: 3.3792,
    areaName: "Ikeja, Lagos",
    effectiveRadiusMeters: 4_000,
    maxRadiusMeters: 4_000,
    liveVoiceSessionId: "session-1",
    liveVoiceEndedAt: null,
    cancelledAt: null,
    metadata: {
      liveConnectionConfirmed: false,
      dangerAlertCode: "DANGER_ZONE_ARMED_ROBBERY_NEARBY",
    },
    createdAt: new Date(),
  };
  const prisma = {
    incident: {
      create: jest.fn().mockResolvedValue({ id: "incident-1" }),
      findUnique: jest.fn().mockResolvedValue({
        country: "Nigeria",
        state: "Lagos",
        lga: "Ikeja",
      }),
    },
    adminUser: {
      findMany: jest.fn().mockResolvedValue([{ id: "admin-1" }]),
    },
    dangerEvent: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(event),
      create: jest.fn().mockResolvedValue(event),
      update: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ ...event, ...data })),
    },
    dangerEventSignal: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue({
        id: "signal-1",
        liveVoiceSessionId: "session-1",
        metadata: {},
      }),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: "signal-1" }),
      update: jest.fn().mockResolvedValue({ id: "signal-1" }),
    },
    liveVideoSession: {
      findUnique: jest.fn().mockResolvedValue({
        id: "session-1",
        status: "Active",
      }),
      update: jest.fn().mockResolvedValue({ id: "session-1", metadata: {} }),
    },
    dangerEventDelivery: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        const key = `${data.dangerEventId}:${data.recipientKey}:${data.alertRevision}`;
        if (claimedDeliveries.has(key)) {
          const error = new Error("duplicate delivery") as any;
          error.code = "P2002";
          throw error;
        }
        claimedDeliveries.add(key);
        return Promise.resolve({ id: `delivery-${claimedDeliveries.size}`, ...data });
      }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    incidentMedia: { findFirst: jest.fn().mockResolvedValue(null) },
    incidentMediaAccessLog: { create: jest.fn().mockResolvedValue({}) },
    deviceGeoState: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "geo-1" }),
      update: jest.fn().mockResolvedValue({ id: "geo-1" }),
    },
    fieldDevice: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
  } as any;
  const jurisdiction = {
    resolve: jest.fn().mockResolvedValue({
      id: "jurisdiction-1",
      country: "Nigeria",
      state: "Lagos",
      lga: "Ikeja",
    }),
  } as any;
  const live = {
    startIncidentLiveVideo: jest.fn().mockResolvedValue({
      data: {
        id: "session-1",
        metadata: {},
        participantIdentity: `user-${actor.sub}`,
      },
      livekit: { url: "wss://live.example", token: "token", roomName: "room-1" },
      connection: {
        serverUrl: "wss://live.example",
        participantToken: "token",
        roomName: "room-1",
        participantIdentity: `user-${actor.sub}`,
      },
    }),
    stopIncidentLiveVideo: jest.fn().mockResolvedValue({}),
  } as any;
  const notifications = {
    create: jest.fn().mockResolvedValue({ data: [{ id: "notification-1" }] }),
  } as any;
  const audit = { record: jest.fn().mockResolvedValue({}) } as any;
  const config = { get: jest.fn().mockReturnValue("4000") } as any;
  const tokens = {} as any;
  const service = new DangerTriggerService(
    prisma,
    jurisdiction,
    live,
    tokens,
    notifications,
    audit,
    config,
  );
  return { service, prisma, live, notifications, audit };
}

const startDto = () => ({
  clientTriggerId: "trigger-1",
  latitude: 6.5244,
  longitude: 3.3792,
  accuracyMeters: 18,
  locationSource: "freshGps" as const,
  locationCapturedAt: new Date().toISOString(),
  areaName: "Ikeja, Lagos",
  spokenLocationName: "Allen Avenue",
  dangerAlertCode: "DANGER_ZONE_ARMED_ROBBERY_NEARBY" as const,
});

describe("DangerTriggerService", () => {
  it("prepares an explicit live voice event without alerting recipients", async () => {
    const { service, prisma, notifications } = buildService();
    const result = await service.prepareLiveVoice(startDto(), actor);

    expect(result.data.event.state).toBe("POTENTIAL");
    expect(prisma.dangerEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            dangerAlertCode: "DANGER_ZONE_ARMED_ROBBERY_NEARBY",
            userDeclaredDangerAlertCode: "DANGER_ZONE_ARMED_ROBBERY_NEARBY",
            dangerAlertCodeSource: "USER_SELECTED",
            spokenLocationName: "Allen Avenue",
          }),
        }),
      }),
    );
    expect(notifications.create.mock.calls.length).toBe(0);
    expect(prisma.liveVideoSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            mediaMode: "audio_only",
            explicitUserActivation: true,
            ambientListening: false,
          }),
        }),
      }),
    );
  });

  it("activates only after a matching connected session is confirmed", async () => {
    const { service, prisma, notifications, audit } = buildService();
    const result = await service.activate(
      "event-1",
      { liveVoiceSessionId: "session-1", connectedAt: new Date().toISOString() },
      actor,
    );

    expect(result.data.state).toBe("ACTIVE");
    expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "danger_trigger.activated" }),
    );
    expect(result.initiatorWatchAlertQueued).toBe(true);
    expect(result.watchRelay.type).toBe("NearbyDangerWarning");
    expect(result.watchRelay.relayToWatch).toBe("true");
    expect(result.watchRelay.areaName).toBe("the reported location");
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: actor.sub,
        channels: ["watch_push"],
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: "admin-1",
        incidentId: "incident-1",
        type: "EmergencyAlert",
        channels: ["in_app", "push"],
        metadata: expect.objectContaining({
          category: "DANGER_ALERT",
          preciseReporterLocationExposed: false,
        }),
      }),
    );
    expect(result.adminNotificationCount).toBe(1);
  });

  it("notifies every distinct eligible user within four kilometres", async () => {
    const { service, prisma, notifications } = buildService();
    const now = new Date();
    prisma.$queryRawUnsafe.mockResolvedValue([
      { userId: "user-a", deviceId: null, latitude: 6.5244, longitude: 3.3792, lastEvaluatedAt: now },
      { userId: "user-b", deviceId: "watch-b", latitude: 6.5424, longitude: 3.3792, lastEvaluatedAt: now },
      { userId: "user-c", deviceId: null, latitude: 6.5594, longitude: 3.3792, lastEvaluatedAt: now },
      { userId: "outside", deviceId: null, latitude: 6.5700, longitude: 3.3792, lastEvaluatedAt: now },
    ]);

    await service.activate(
      "event-1",
      { liveVoiceSessionId: "session-1", connectedAt: now.toISOString() },
      actor,
    );

    const mobileRecipients = notifications.create.mock.calls
      .map((call: any[]) => call[0])
      .filter((input: any) => input.userId && input.channels.includes("push"))
      .map((input: any) => input.userId);
    expect(mobileRecipients).toEqual(["user-a", "user-c"]);
    const userBWatchAlerts = notifications.create.mock.calls
      .map((call: any[]) => call[0])
      .filter((input: any) => input.userId === "user-b" && input.channels.includes("watch_push"));
    expect(userBWatchAlerts.length).toBe(1);
    expect(userBWatchAlerts[0].metadata.deviceId).toBe("watch-b");
  });

  it("delivers once when a trusted user later enters an active danger zone", async () => {
    const { service, prisma, notifications } = buildService();
    const now = new Date();
    prisma.dangerEvent.findMany.mockResolvedValue([{
      id: "active-event",
      incidentId: "incident-1",
      initiatorUserId: actor.sub,
      state: "ACTIVE",
      latitude: 6.5244,
      longitude: 3.3792,
      effectiveRadiusMeters: 4_000,
      areaName: "Ikeja, Lagos",
      createdAt: now,
      liveVoiceEndedAt: null,
      metadata: {
        alertRevision: 1,
        expiresAt: new Date(now.getTime() + 60 * 60_000).toISOString(),
        dangerAlertCode: "DANGER_ZONE_FIRE_NEARBY",
        spokenLocationName: "Allen Avenue",
      },
    }]);

    const input = {
      recipientType: "mobile" as const,
      recipientUserId: "late-user",
      latitude: 6.525,
      longitude: 3.3792,
      accuracyMeters: 12,
      capturedAt: now,
    };
    const first = await service.evaluateTrustedLocation(input);
    const second = await service.evaluateTrustedLocation(input);

    expect(first.alerts).toHaveLength(1);
    expect(second.alerts[0]).toEqual(
      expect.objectContaining({ suppressed: true, reason: "delivery_dedupe" }),
    );
    const lateNotifications = notifications.create.mock.calls
      .map((call: any[]) => call[0])
      .filter((value: any) => value.userId === "late-user");
    expect(lateNotifications).toHaveLength(1);
    expect(lateNotifications[0].metadata.deliveryReason).toBe("ACTIVE_ZONE_ENTRY");
    expect(lateNotifications[0].metadata.preciseReporterLocationExposed).toBe(false);
    expect(lateNotifications[0].metadata.approximateArea).toBe("Allen Avenue");
  });

  it("does not deliver for stale, inaccurate, or terminal zone evaluations", async () => {
    const stale = buildService();
    const staleResult = await stale.service.evaluateTrustedLocation({
      recipientType: "mobile",
      recipientUserId: "late-user",
      latitude: 6.525,
      longitude: 3.3792,
      accuracyMeters: 10,
      capturedAt: new Date(Date.now() - 6 * 60_000),
    });
    expect(staleResult.reason).toBe("untrusted_location");

    const inaccurate = buildService();
    const inaccurateResult = await inaccurate.service.evaluateTrustedLocation({
      recipientType: "mobile",
      recipientUserId: "late-user",
      latitude: 6.525,
      longitude: 3.3792,
      accuracyMeters: 151,
      capturedAt: new Date(),
    });
    expect(inaccurateResult.reason).toBe("untrusted_location");

    const terminal = buildService();
    terminal.prisma.dangerEvent.findMany.mockResolvedValue([
      {
        id: "resolved-event",
        state: "RESOLVED",
        latitude: 6.5244,
        longitude: 3.3792,
        effectiveRadiusMeters: 4_000,
        createdAt: new Date(),
        metadata: {},
      },
      {
        id: "cancelled-event",
        state: "FALSE_ALARM",
        latitude: 6.5244,
        longitude: 3.3792,
        effectiveRadiusMeters: 4_000,
        createdAt: new Date(),
        metadata: {},
      },
      {
        id: "expired-event",
        state: "ACTIVE",
        latitude: 6.5244,
        longitude: 3.3792,
        effectiveRadiusMeters: 4_000,
        createdAt: new Date(Date.now() - 7 * 60 * 60_000),
        metadata: {
          expiresAt: new Date(Date.now() - 60_000).toISOString(),
        },
      },
    ]);
    const terminalResult = await terminal.service.evaluateTrustedLocation({
      recipientType: "mobile",
      recipientUserId: "late-user",
      latitude: 6.525,
      longitude: 3.3792,
      accuracyMeters: 10,
      capturedAt: new Date(),
    });
    expect(terminalResult.alerts).toHaveLength(0);
    expect(terminal.notifications.create).toHaveBeenCalledTimes(0);
  });

  it("allows a backend-approved alert revision to notify the same device again", async () => {
    const { service, prisma, notifications } = buildService();
    const now = new Date();
    const event = {
      id: "active-event",
      incidentId: "incident-1",
      initiatorUserId: actor.sub,
      state: "ACTIVE",
      latitude: 6.5244,
      longitude: 3.3792,
      effectiveRadiusMeters: 4_000,
      areaName: "Ikeja, Lagos",
      createdAt: now,
      liveVoiceEndedAt: null,
      metadata: {
        alertRevision: 1,
        expiresAt: new Date(now.getTime() + 60 * 60_000).toISOString(),
        dangerAlertCode: "DANGER_ZONE_FIRE_NEARBY",
      },
    };
    prisma.dangerEvent.findMany.mockResolvedValue([event]);
    const input = {
      recipientType: "watch" as const,
      recipientUserId: "late-user",
      deviceId: "watch-1",
      latitude: 6.525,
      longitude: 3.3792,
      accuracyMeters: 12,
      capturedAt: now,
    };

    await service.evaluateTrustedLocation(input);
    event.metadata.alertRevision = 2;
    await service.evaluateTrustedLocation({ ...input, capturedAt: new Date() });

    const watchNotifications = notifications.create.mock.calls
      .map((call: any[]) => call[0])
      .filter((value: any) => value.metadata?.deviceId === "watch-1");
    expect(watchNotifications).toHaveLength(2);
    expect(watchNotifications[1].metadata.dangerAlert.version).toBe(2);
  });

  it("notifies only active field tablets inside the authorized radius", async () => {
    const { service, prisma, notifications } = buildService();
    const now = new Date();
    prisma.fieldDevice.findMany.mockResolvedValue([
      {
        id: "field-inside",
        assignedUserId: "admin-inside",
        lastKnownLatitude: 6.5244,
        lastKnownLongitude: 3.3792,
        lastLocationAt: now,
      },
      {
        id: "field-outside",
        assignedUserId: "admin-outside",
        lastKnownLatitude: 6.58,
        lastKnownLongitude: 3.3792,
        lastLocationAt: now,
      },
    ]);

    const result = await service.activate(
      "event-1",
      { liveVoiceSessionId: "session-1", connectedAt: now.toISOString() },
      actor,
    );

    const fieldAlerts = notifications.create.mock.calls
      .map((call: any[]) => call[0])
      .filter((input: any) => input.metadata?.deviceId?.startsWith("field-"));
    expect(fieldAlerts.length).toBe(1);
    expect(fieldAlerts[0].adminUserId).toBe("admin-inside");
    expect(fieldAlerts[0].metadata.preciseReporterLocationExposed).toBe(false);
    expect(fieldAlerts[0].metadata.dangerAlert.expiresAt).toBeDefined();
    expect(fieldAlerts[0].metadata.dangerAlert.alertCode).toBe(
      "DANGER_ZONE_ARMED_ROBBERY_NEARBY",
    );
    expect(result.fanout.fieldRecipients).toBe(1);
  });

  it("marks private original voice availability without exposing its object key", async () => {
    const { service, prisma, notifications } = buildService();
    const now = new Date();
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        userId: "voice-recipient",
        deviceId: null,
        latitude: 6.525,
        longitude: 3.3792,
        accuracyMeters: 10,
        lastEvaluatedAt: now,
      },
    ]);
    prisma.incidentMedia.findFirst.mockResolvedValue({
      id: "voice-media",
      objectKey: "private/incident/original-voice.m4a",
    });

    await service.activate(
      "event-1",
      { liveVoiceSessionId: "session-1", connectedAt: now.toISOString() },
      actor,
    );

    const alert = notifications.create.mock.calls
      .map((call: any[]) => call[0])
      .find((value: any) => value.userId === "voice-recipient");
    expect(alert.metadata.dangerAlert.hasOriginalVoice).toBe(true);
    expect(alert.metadata.originalVoiceProvenance).toBe("ORIGINAL_VOICE_NOTE");
    expect(JSON.stringify(alert)).not.toContain("original-voice.m4a");
    expect(JSON.stringify(alert)).not.toContain("signedUrl");
  });

  it("denies original voice access to a recipient outside the active zone", async () => {
    const { service, prisma } = buildService();
    prisma.deviceGeoState.findMany.mockResolvedValue([]);

    await expect(service.originalVoice("event-1", {
      ...actor,
      sub: "22222222-2222-4222-8222-222222222222",
    })).rejects.toThrow("outside your authorized area");
    expect(prisma.incidentMedia.findFirst).toHaveBeenCalledTimes(0);
  });

  it("classifies repeated non-QA danger triggers near the requested area", async () => {
    const { service, prisma } = buildService();
    prisma.dangerEvent.findMany.mockResolvedValue([
      { latitude: 6.5244, longitude: 3.3792, areaName: "Ikeja", metadata: {} },
      { latitude: 6.5250, longitude: 3.3800, areaName: "Ikeja", metadata: {} },
      { latitude: 6.5260, longitude: 3.3810, areaName: "Ikeja", metadata: { qaTest: true } },
    ]);

    const result = await service.areaRisk(6.5244, 3.3792, actor);

    expect(result.data.level).toBe("MEDIUM_RISK");
    expect(result.data.eventCount).toBe(2);
    expect(result.data.radiusMeters).toBe(4_000);
    expect(result.data.approximateArea).toBe("Ikeja");
  });

  it("returns green safe when no qualifying danger pattern exists", async () => {
    const { service, prisma } = buildService();
    prisma.dangerEvent.findMany.mockResolvedValue([]);

    const result = await service.areaRisk(6.5244, 3.3792, actor);

    expect(result.data.level).toBe("GREEN_SAFE");
    expect(result.data.eventCount).toBe(0);
  });

  it("ending voice preserves the danger event state", async () => {
    const { service, prisma, live } = buildService();
    prisma.dangerEvent.findUnique.mockResolvedValue({
      ...await prisma.dangerEvent.findUnique(),
      state: "ACTIVE",
    });
    await service.stopLiveVoice("event-1", actor);

    expect(live.stopIncidentLiveVideo).toHaveBeenCalled();
    const update = prisma.dangerEvent.update.mock.calls[0][0];
    expect(update.data.liveVoiceEndedAt).toBeDefined();
    expect(update.data.state).toBeUndefined();
  });
});
