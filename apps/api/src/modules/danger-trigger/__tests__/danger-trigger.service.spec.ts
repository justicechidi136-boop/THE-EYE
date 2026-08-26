import { DangerTriggerService } from "../danger-trigger.service";

const actor = {
  typ: "user",
  sub: "11111111-1111-4111-8111-111111111111",
  role: "Citizen",
  permissions: ["incident:create", "incident:read"],
} as any;

function buildService() {
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
    metadata: { liveConnectionConfirmed: false },
    createdAt: new Date(),
  };
  const prisma = {
    incident: {
      create: jest.fn().mockResolvedValue({ id: "incident-1" }),
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
    deviceGeoState: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
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
  const notifications = { create: jest.fn().mockResolvedValue({}) } as any;
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
});

describe("DangerTriggerService", () => {
  it("prepares an explicit live voice event without alerting recipients", async () => {
    const { service, prisma, notifications } = buildService();
    const result = await service.prepareLiveVoice(startDto(), actor);

    expect(result.data.event.state).toBe("POTENTIAL");
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
    const { service, prisma, audit } = buildService();
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
