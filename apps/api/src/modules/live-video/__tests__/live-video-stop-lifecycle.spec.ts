import { IncidentStatus, IncidentType, ResolutionSource } from "@the-eye/shared";
import { LiveVideoService } from "../live-video.service";

const citizen = { typ: "user", sub: "user-1" } as any;

function buildService(options: { standalone?: boolean } = {}) {
  const incident = {
    id: "incident-1",
    reporterId: "user-1",
    type: IncidentType.Emergency,
    title: "Live emergency video",
    status: IncidentStatus.Submitted,
    metadata: options.standalone
      ? { source: "live_emergency_video", standaloneLiveEmergency: true }
      : {},
  };
  const session = {
    id: "session-1",
    incidentId: incident.id,
    createdById: citizen.sub,
    status: "Active",
    metadata: { standaloneLiveEmergency: options.standalone === true },
    incident,
  };
  const updatedSession = { ...session, status: "Ended", endedAt: new Date() };
  const transaction = {
    liveVideoSession: { update: jest.fn().mockResolvedValue(updatedSession) },
    incident: {
      update: jest.fn().mockResolvedValue({
        ...incident,
        status: IncidentStatus.Resolved,
      }),
    },
  };
  const prisma = {
    liveVideoSession: {
      findUnique: jest.fn().mockResolvedValue(session),
      update: jest.fn().mockResolvedValue(updatedSession),
    },
    incidentTimeline: { create: jest.fn().mockResolvedValue({ id: "timeline-1" }) },
    $transaction: jest.fn(async (operation: (client: typeof transaction) => unknown) =>
      operation(transaction),
    ),
  } as any;
  const audit = { record: jest.fn().mockResolvedValue({ id: "audit-1" }) } as any;
  const service = new LiveVideoService(
    prisma,
    {} as any,
    { get: jest.fn() } as any,
    audit,
    {} as any,
  );
  return { service, prisma, transaction };
}

describe("LiveVideoService standalone emergency stop lifecycle", () => {
  it("atomically ends and archives a standalone live emergency", async () => {
    const { service, prisma, transaction } = buildService({ standalone: true });

    const result = await service.stopIncidentLiveVideo("session-1", citizen);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.incident.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "incident-1" },
        data: expect.objectContaining({
          status: IncidentStatus.Resolved,
          resolutionSource: ResolutionSource.Reporter,
          timeline: expect.objectContaining({ create: expect.objectContaining({
            eventType: "live_video.emergency_ended",
          }) }),
          statusHistory: expect.objectContaining({ create: expect.objectContaining({
            fromStatus: IncidentStatus.Submitted,
            toStatus: IncidentStatus.Resolved,
          }) }),
        }),
      }),
    );
    expect(result.incident).toEqual({
      id: "incident-1",
      status: IncidentStatus.Resolved,
      archived: true,
    });
  });

  it("ends attached video without closing an existing emergency", async () => {
    const { service, prisma } = buildService();

    const result = await service.stopIncidentLiveVideo("session-1", citizen);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.liveVideoSession.update).toHaveBeenCalled();
    expect(result.incident.archived).toBe(false);
    expect(result.incident.status).toBe(IncidentStatus.Submitted);
  });
});
