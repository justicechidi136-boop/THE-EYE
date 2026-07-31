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
    isAnonymous: false,
    submittedAt: new Date("2026-07-31T00:00:00.000Z"),
  };
  const prisma = {
    incident: { findUnique: jest.fn().mockResolvedValue(incident) },
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
    const { service, tokens } = buildStartService();
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
