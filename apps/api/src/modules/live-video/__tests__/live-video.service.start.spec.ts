import { ConfigService } from "@nestjs/config";
import { createMetricsMock } from "../../../common/metrics/metrics.test-utils";
import { LiveVideoErrorCode } from "../live-video.errors";
import { LiveVideoService } from "../live-video.service";

const citizen = {
  typ: "user",
  sub: "user-1",
  role: "Citizen",
  permissions: ["incident:create"],
} as any;

const fieldOfficer = {
  typ: "field",
  sub: "field-officer-1",
  permissions: ["field:session:operate"],
  country: "Nigeria",
  state: "Lagos",
  lga: "Ikeja",
  fieldDeviceId: "field-device-1",
} as any;

function buildStartService(options: {
  publicUrl?: string;
  token?: string;
  includeToken?: boolean;
} = {}) {
  const session = {
    id: "session-1",
    incidentId: "incident-1",
    roomName: "eye-incident-incident-1",
    livekitRoomId: "eye-incident-incident-1",
    createdById: "user-1",
    status: "Active",
    lowBandwidthMode: false,
    participantIdentity: "user-user-1",
    startedAt: new Date("2026-07-31T00:00:00.000Z"),
    endedAt: null,
    recordingMediaId: null,
    metadata: {},
    createdAt: new Date("2026-07-31T00:00:00.000Z"),
  };
  const incident = {
    id: "incident-1",
    reporterId: "user-1",
    type: "Emergency",
    title: "Live emergency video",
    metadata: {},
    isAnonymous: false,
    submittedAt: new Date("2026-07-31T00:00:00.000Z"),
  };
  const prisma = {
    incident: {
      findUnique: jest.fn().mockResolvedValue(incident),
      update: jest.fn().mockResolvedValue(incident),
    },
    liveVideoSession: { upsert: jest.fn().mockResolvedValue(session) },
    incidentTimeline: { create: jest.fn().mockResolvedValue({ id: "timeline-1" }) },
    liveVideoLocationUpdate: { create: jest.fn() },
  } as any;
  const token =
    options.token ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTl9.signature";
  const tokens = {
    assertLiveKitConfigured: jest.fn(),
    clientLivekitUrl: jest
      .fn()
      .mockReturnValue(options.publicUrl ?? "wss://staging-livekit.theeye.com.ng"),
    createToken: jest.fn().mockImplementation(() => {
      if (options.includeToken === false) return "";
      return token;
    }),
    livekitApiKey: jest.fn().mockReturnValue("APITESTKEY1"),
  } as any;
  const config = {
    get: jest.fn((key: string, fallback: string) => fallback),
  } as unknown as ConfigService;
  const auditService = { record: jest.fn().mockResolvedValue({ id: "audit-1" }) } as any;
  const service = new LiveVideoService(
    prisma,
    tokens,
    config,
    auditService,
    createMetricsMock(),
  );
  return { service, tokens, prisma };
}

describe("LiveVideoService startIncidentLiveVideo", () => {
  it("returns public connection details and legacy livekit envelope", async () => {
    const { service, tokens, prisma } = buildStartService();
    const result = await service.startIncidentLiveVideo(
      "incident-1",
      {},
      citizen,
      { requestId: "req-1", clientTraceId: "trace-1" },
    );

    expect(tokens.createToken).toHaveBeenCalledWith(
      expect.objectContaining({
        roomName: "eye-incident-incident-1",
        canPublish: true,
        canSubscribe: false,
      }),
    );
    expect(result.connection.serverUrl).toBe("wss://staging-livekit.theeye.com.ng");
    expect(result.connection.participantToken).toContain(".");
    expect(result.connection.roomName).toBe("eye-incident-incident-1");
    expect(result.connection.participantIdentity).toBe("user-user-1");
    expect(result.livekit.url).toBe(result.connection.serverUrl);
    expect(result.livekit.token).toBe(result.connection.participantToken);
    expect(result.data.correlationId).toBe("trace-1");
    expect(prisma.liveVideoSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { roomName: "eye-incident-incident-1" },
        create: expect.objectContaining({ incidentId: "incident-1" }),
      }),
    );
    expect(prisma.incident.create).toBe(undefined);
  });

  it("fails instead of returning success when token generation yields empty token", async () => {
    const { service } = buildStartService({ includeToken: false });
    await expect(
      service.startIncidentLiveVideo("incident-1", {}, citizen, { requestId: "req-2" }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: LiveVideoErrorCode.TOKEN_CONNECTION_INCOMPLETE,
      }),
    });
  });
});

describe("LiveVideoService startFieldBroadcastLiveVideo", () => {
  it("links a field-owned broadcast to one operational incident and starts LiveKit", async () => {
    const { service, prisma, tokens } = buildStartService();
    prisma.broadcast = {
      findUnique: jest.fn().mockResolvedValue({
        id: "broadcast-1",
        creatorAdminId: fieldOfficer.sub,
        incidentId: null,
        jurisdictionId: "jurisdiction-1",
        country: "Nigeria",
        state: "Lagos",
        lga: "Ikeja",
        type: "Emergency",
        priority: "P1LifeThreatening",
        title: "Flood warning",
        body: "Avoid the flooded road.",
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    prisma.incident.create = jest.fn().mockResolvedValue({ id: "incident-field-1" });
    prisma.incident.delete = jest.fn();
    prisma.incident.findUnique.mockResolvedValue({
      id: "incident-field-1",
      reporterId: null,
      assignedAdminId: fieldOfficer.sub,
      isAnonymous: false,
      submittedAt: new Date("2026-08-25T00:00:00.000Z"),
    });

    const result = await service.startFieldBroadcastLiveVideo(
      "broadcast-1",
      { latitude: 6.6018, longitude: 3.3515 },
      fieldOfficer,
      { requestId: "req-field-1" },
    );

    expect(prisma.broadcast.updateMany).toHaveBeenCalledWith({
      where: { id: "broadcast-1", incidentId: null },
      data: { incidentId: "incident-field-1" },
    });
    expect(tokens.createToken).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: "field-field-officer-1",
        roomName: "eye-incident-incident-field-1",
        canPublish: true,
      }),
    );
    expect(result.connection.participantIdentity).toBe("field-field-officer-1");
  });

  it("marks an owned standalone live emergency for terminal stop handling", async () => {
    const { service, prisma } = buildStartService();
    await service.startIncidentLiveVideo(
      "incident-1",
      { standaloneEmergency: true },
      citizen,
      { requestId: "req-standalone" },
    );

    expect(prisma.incident.update).toHaveBeenCalledWith({
      where: { id: "incident-1" },
      data: {
        metadata: {
          source: "live_emergency_video",
          standaloneLiveEmergency: true,
        },
      },
    });
    expect(prisma.liveVideoSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          metadata: expect.objectContaining({
            standaloneLiveEmergency: true,
          }),
        }),
      }),
    );
  });

  it("rejects a field officer who did not submit the broadcast", async () => {
    const { service, prisma } = buildStartService();
    prisma.broadcast = {
      findUnique: jest.fn().mockResolvedValue({
        id: "broadcast-1",
        creatorAdminId: "another-officer",
      }),
    };

    await expect(
      service.startFieldBroadcastLiveVideo(
        "broadcast-1",
        {},
        fieldOfficer,
        { requestId: "req-field-2" },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: LiveVideoErrorCode.NOT_AUTHORIZED }),
    });
  });
});
