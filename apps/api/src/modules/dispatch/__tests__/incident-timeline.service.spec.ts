import { IncidentTimelineService } from "../incident-timeline.service";

function buildTimelineService(overrides: Partial<Record<string, any>> = {}) {
  const prisma = {
    incident: {
      findUnique: jest.fn(),
    },
    ...(overrides.prisma ?? {}),
  };
  return { service: new IncidentTimelineService(prisma as any), prisma };
}

describe("IncidentTimelineService", () => {
  it("hides internal notes from citizen audience", async () => {
    const { service, prisma } = buildTimelineService({
      prisma: {
        incidentAssignment: { findMany: jest.fn().mockResolvedValue([]) },
        dispatchEvent: {
          findMany: jest.fn().mockResolvedValue([
            {
              createdAt: new Date("2026-07-22T10:00:00Z"),
              eventType: "assignment.internal_note",
              message: "Sensitive note",
              metadata: { internal: true },
            },
          ]),
        },
      },
    });

    prisma.incident.findUnique.mockResolvedValue({
      id: "inc-1",
      submittedAt: new Date("2026-07-22T09:00:00Z"),
      updatedAt: new Date("2026-07-22T09:05:00Z"),
      metadata: {},
      timeline: [],
      statusHistory: [],
      verifications: [],
      media: [],
      assignedAgency: null,
    });

    const citizenView = await service.buildTimeline("inc-1", "citizen");
    expect(citizenView.data.some((entry) => String(entry.type).includes("note"))).toBe(false);

    const dispatcherView = await service.buildTimeline("inc-1", "dispatcher");
    expect(dispatcherView.data.some((entry) => String(entry.type).includes("note"))).toBe(true);
  });

  it("includes assignment milestones for citizen audience", async () => {
    const acceptedAt = new Date("2026-07-22T10:15:00Z");
    const { service, prisma } = buildTimelineService({
      prisma: {
        incidentAssignment: {
          findMany: jest.fn().mockResolvedValue([
            {
              createdAt: new Date("2026-07-22T10:05:00Z"),
              acceptedAt,
              enRouteAt: null,
              arrivedAt: null,
              completedAt: null,
              status: "Accepted",
              agency: { name: "Lagos EMS" },
              responder: { displayName: "Unit 12" },
            },
          ]),
        },
        dispatchEvent: { findMany: jest.fn().mockResolvedValue([]) },
      },
    });

    prisma.incident.findUnique.mockResolvedValue({
      id: "inc-1",
      submittedAt: new Date("2026-07-22T10:00:00Z"),
      updatedAt: new Date("2026-07-22T10:05:00Z"),
      metadata: {},
      timeline: [],
      statusHistory: [],
      verifications: [],
      media: [],
      assignedAgency: { name: "Lagos EMS" },
    });

    const result = await service.buildTimeline("inc-1", "citizen");
    const labels = result.data.map((entry) => String(entry.label));
    expect(labels).toEqual(expect.arrayContaining(["Emergency report submitted", "Responder assigned", "Responder accepted"]));
  });
});
