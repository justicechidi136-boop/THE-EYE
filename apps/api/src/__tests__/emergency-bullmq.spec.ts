import { IncidentPriority, IncidentStatus, IncidentType } from "@the-eye/shared";
import { buildNotificationDispatchJobId } from "../common/queue/queue-jobs";
import { assertValidBullJobId } from "../common/queue/bull-job-id";
import { IncidentsService } from "../modules/incidents/incidents.service";
import { JurisdictionResolutionStatus } from "../modules/incidents/jurisdiction-resolution.service";

describe("emergency incident BullMQ job ids", () => {
  it("builds valid notification job ids for emergency contact sms dispatches", () => {
    const jobId = buildNotificationDispatchJobId({
      channel: "sms",
      phone: "+2348012345678",
      notificationId: "notification-1",
    });
    expect(jobId).not.toContain(":");
    expect(() => assertValidBullJobId(jobId)).not.toThrow();
  });

  it("builds valid notification job ids for crowd confirmation push dispatches", () => {
    const jobId = buildNotificationDispatchJobId({
      notificationId: "notification-1",
      channel: "push",
      userId: "user-1",
    });
    expect(jobId).toBe("notify-notification-1-push-user-1");
    expect(() => assertValidBullJobId(jobId)).not.toThrow();
  });

  it("queues emergency contact notifications with colon-free job ids", async () => {
    const incidentCreate = jest.fn().mockResolvedValue({
      id: "incident-1",
      status: IncidentStatus.Submitted,
      priority: IncidentPriority.P1LifeThreatening,
      submittedAt: new Date("2026-07-30T08:00:00.000Z"),
    });
    const prisma = {
      incident: {
        create: incidentCreate,
        findUnique: jest.fn().mockResolvedValue(null),
      },
      incidentTimeline: { create: jest.fn().mockResolvedValue({ id: "timeline-1" }) },
      emergencyContact: {
        findMany: jest.fn().mockResolvedValue([
          { id: "contact-1", name: "Ada", phone: "+2348011111111" },
          { id: "contact-2", name: "Ben", phone: "+2348022222222" },
        ]),
      },
    } as any;

    const queueAdd = jest.fn().mockResolvedValue({ id: "notify-notification-1-sms-+2348011111111" });
    const notifications = {
      enqueue: jest.fn(async (payload) => {
        const jobId = buildNotificationDispatchJobId(payload);
        assertValidBullJobId(jobId);
        return queueAdd(jobId);
      }),
    } as any;

    const service = new IncidentsService(
      prisma,
      { record: jest.fn() } as any,
      { recordIncidentSubmission: jest.fn() } as any,
      { verifyIncident: jest.fn().mockResolvedValue(undefined) } as any,
      notifications,
      { runTriageForIncident: jest.fn().mockResolvedValue(undefined) } as any,
      {} as any,
      {} as any,
      { scheduleRetry: jest.fn() } as any,
      {} as any,
      {} as any,
      {
        resolve: jest.fn().mockResolvedValue({
          id: "jurisdiction-1",
          country: "Nigeria",
          state: "Lagos",
          lga: "Ikeja",
          resolutionStatus: JurisdictionResolutionStatus.ResolvedByCoordinates,
          resolutionSource: "postgis_polygon",
        }),
      } as any,
    );

    const response = await service.reportEmergency(
      {
        type: IncidentType.Emergency,
        description: "Emergency live video started.",
        latitude: 6.6018,
        longitude: 3.3515,
        anonymous: false,
        notifyEmergencyContacts: true,
      },
      { typ: "user", sub: "user-1" } as any,
    );

    expect(response.id).toBe("incident-1");
    expect(notifications.enqueue).toHaveBeenCalledTimes(2);
    for (const call of notifications.enqueue.mock.calls) {
      const jobId = buildNotificationDispatchJobId(call[0]);
      expect(jobId).not.toContain(":");
    }
  });
});
