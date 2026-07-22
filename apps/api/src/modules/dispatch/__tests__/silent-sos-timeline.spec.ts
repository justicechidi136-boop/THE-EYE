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

describe("IncidentTimelineService silent privacy", () => {
  it("uses discreet citizen labels for silent incidents", async () => {
    const { service, prisma } = buildTimelineService({
      prisma: {
        incidentAssignment: { findMany: jest.fn().mockResolvedValue([]) },
        dispatchEvent: { findMany: jest.fn().mockResolvedValue([]) },
      },
    });

    prisma.incident.findUnique.mockResolvedValue({
      id: "inc-silent",
      submittedAt: new Date("2026-07-22T09:00:00Z"),
      updatedAt: new Date("2026-07-22T09:05:00Z"),
      metadata: { silent: true },
      timeline: [],
      statusHistory: [],
      verifications: [],
      media: [],
      assignedAgency: null,
    });

    const citizenView = await service.buildTimeline("inc-silent", "citizen");
    expect(citizenView.data[0]?.label).toBe("Status update received");
    expect(citizenView.data.some((entry) => String(entry.type).includes("silent"))).toBe(false);

    const dispatcherView = await service.buildTimeline("inc-silent", "dispatcher");
    expect(dispatcherView.data.some((entry) => entry.type === "report.silent")).toBe(true);
  });
});
