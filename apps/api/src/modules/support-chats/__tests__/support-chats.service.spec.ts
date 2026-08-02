import { BadRequestException } from "@nestjs/common";
import { SupportChatsService } from "../support-chats.service";
import { encodeDateIdCursor } from "../../../common/pagination/cursor-pagination";

function createListService() {
  const prisma = {
    supportConversation: {
      findMany: jest.fn(),
    },
  };
  const audit = { record: jest.fn() };
  const service = Object.create(SupportChatsService.prototype) as SupportChatsService;
  Object.assign(service, { prisma, audit });
  return { service, prisma };
}

describe("SupportChatsService.list", () => {
  const actor = {
    typ: "admin" as const,
    sub: "admin-1",
    role: "Super Admin",
    permissions: ["incident:read", "incident:update"],
  };

  it("returns paginated conversations", async () => {
    const { service, prisma } = createListService();
    prisma.supportConversation.findMany.mockResolvedValue([
      {
        id: "c1",
        reference: "SC-ABC",
        type: "Incident",
        status: "Open",
        priority: "High",
        subject: "Citizen follow-up",
        incidentId: "inc-1",
        assignedAdminId: "admin-1",
        unreadAdmin: 1,
        lastMessageAt: new Date("2026-08-02T10:00:00.000Z"),
        createdAt: new Date("2026-08-02T09:00:00.000Z"),
        incident: { id: "inc-1", title: "Robbery", status: "Assigned", priority: "P2ActiveCrimeAccident" },
        assignedAdmin: { id: "admin-1", displayName: "Ops Lead" },
        participants: [],
        messages: [{ body: "Need update", hasAttachment: false }],
      },
    ]);

    const page = await service.list(actor, { limit: "50" });
    expect(page.data).toHaveLength(1);
    expect(page.data[0]?.reference).toBe("SC-ABC");
  });

  it("returns HTTP 400 for invalid cursor", async () => {
    const { service, prisma } = createListService();
    await expect(service.list(actor, { cursor: "bad-cursor" })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.supportConversation.findMany).not.toHaveBeenCalled();
  });

  it("encodes nextCursor from createdAt and id", async () => {
    const { service, prisma } = createListService();
    const createdAt = new Date("2026-08-02T09:00:00.000Z");
    prisma.supportConversation.findMany.mockResolvedValue([
      { id: "c2", reference: "SC-2", type: "CitizenSupport", status: "Open", priority: "Normal", subject: "A", createdAt, incident: null, assignedAdmin: null, participants: [], messages: [] },
      { id: "c1", reference: "SC-1", type: "CitizenSupport", status: "Open", priority: "Normal", subject: "B", createdAt: new Date("2026-08-02T08:00:00.000Z"), incident: null, assignedAdmin: null, participants: [], messages: [] },
    ]);
    const page = await service.list(actor, { limit: "1" });
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe(encodeDateIdCursor(createdAt, "c2"));
  });
});
