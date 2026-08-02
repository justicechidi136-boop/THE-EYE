import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { SupportChatsService } from "../support-chats.service";
import { encodeDateIdCursor } from "../../../common/pagination/cursor-pagination";

function createService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    supportConversation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    supportMessage: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    incident: { findFirst: jest.fn() },
    smartwatchDevice: { findFirst: jest.fn() },
    communityMembership: { findFirst: jest.fn() },
    ...overrides,
  };
  const audit = { record: jest.fn() };
  const notifications = { enqueue: jest.fn() };
  const service = Object.create(SupportChatsService.prototype) as SupportChatsService;
  Object.assign(service, { prisma, audit, notifications });
  return { service, prisma, audit, notifications };
}

describe("SupportChatsService", () => {
  const admin = {
    typ: "admin" as const,
    sub: "admin-1",
    role: "Super Admin",
    permissions: ["incident:read", "incident:update", "support:internal-note:create"],
  };
  const citizen = {
    typ: "user" as const,
    sub: "user-1",
    role: "Citizen",
    permissions: ["incident:create", "incident:read"],
  };

  it("returns HTTP 400 for invalid cursor on admin list", async () => {
    const { service, prisma } = createService();
    await expect(service.list(admin, { cursor: "bad-cursor" })).rejects.toThrow("cursor is invalid");
    expect(prisma.supportConversation.findMany).not.toHaveBeenCalled();
  });

  it("creates citizen conversation with participant and first message", async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({
      email: "citizen@example.com",
      profile: { firstName: "Ada", lastName: "Okafor" },
    });
    prisma.supportConversation.create.mockResolvedValue({ id: "conv-1" });
    prisma.supportMessage.create.mockResolvedValue({ id: "msg-1", createdAt: new Date() });
    prisma.supportConversation.findFirst.mockResolvedValue({
      id: "conv-1",
      reference: "SC-1",
      subject: "Login issue",
      status: "WaitingForAdmin",
      category: "AccountAccess",
      type: "CitizenSupport",
      priority: "Normal",
      unreadCitizen: 0,
      createdAt: new Date(),
      incident: null,
      assignedAdmin: null,
      participants: [],
      messages: [],
    });

    const detail = await service.createMine(citizen, {
      category: "AccountAccess" as never,
      subject: "Login issue",
      body: "Cannot receive OTP",
    });
    expect(detail.id).toBe("conv-1");
    expect(prisma.supportConversation.create).toHaveBeenCalled();
    expect(prisma.supportMessage.create).toHaveBeenCalled();
  });

  it("denies citizen access to another users conversation", async () => {
    const { service, prisma } = createService();
    prisma.supportConversation.findFirst.mockResolvedValue(null);
    await expect(service.getMine(citizen, "conv-x")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("hides internal notes from citizen detail mapping", async () => {
    const { service, prisma } = createService();
    prisma.supportConversation.findFirst.mockResolvedValue({
      id: "conv-1",
      reference: "SC-1",
      subject: "Help",
      status: "Open",
      category: "Other",
      type: "CitizenSupport",
      priority: "Normal",
      unreadCitizen: 1,
      createdAt: new Date(),
      incident: null,
      assignedAdmin: null,
      participants: [],
      messages: [
        {
          id: "m1",
          body: "Visible",
          senderRole: "Admin",
          visibility: "UserVisible",
          isInternal: false,
          hasAttachment: false,
          createdAt: new Date().toISOString(),
          adminUser: { displayName: "Support" },
        },
        {
          id: "m2",
          body: "Hidden note",
          senderRole: "Admin",
          visibility: "AdminInternal",
          isInternal: true,
          hasAttachment: false,
          createdAt: new Date().toISOString(),
          adminUser: { displayName: "Support" },
        },
      ],
    });
    const detail = await service.getMine(citizen, "conv-1");
    expect(detail.messages).toHaveLength(1);
    expect(detail.messages[0]?.body).toBe("Visible");
  });

  it("deduplicates messages by clientMessageId", async () => {
    const { service, prisma } = createService();
    prisma.supportConversation.findFirst.mockResolvedValue({
      id: "conv-1",
      status: "Open",
      userId: "user-1",
    });
    prisma.supportMessage.findFirst.mockResolvedValue({
      id: "existing",
      body: "Hello",
      senderRole: "Citizen",
      visibility: "UserVisible",
      isInternal: false,
      hasAttachment: false,
      createdAt: new Date(),
      clientMessageId: "client-1",
    });
    const message = await service.sendCitizenMessage(citizen, "conv-1", {
      body: "Hello",
      clientMessageId: "client-1",
    });
    expect(message.id).toBe("existing");
    expect(prisma.supportMessage.create).not.toHaveBeenCalled();
  });

  it("scopes state admin to jurisdiction", async () => {
    const { service, prisma } = createService();
    const stateAdmin = {
      ...admin,
      role: "State Admin",
      country: "NG",
      state: "LA",
      permissions: ["incident:read"],
    };
    prisma.supportConversation.findFirst.mockResolvedValue(null);
    await expect(service.getById(stateAdmin, "conv-out-of-state")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.supportConversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ country: "NG", state: "LA" }),
      }),
    );
  });

  it("encodes nextCursor from createdAt and id", async () => {
    const { service, prisma } = createService();
    const createdAt = new Date("2026-08-02T09:00:00.000Z");
    prisma.supportConversation.findMany.mockResolvedValue([
      {
        id: "c2",
        reference: "SC-2",
        type: "CitizenSupport",
        category: "Other",
        status: "Open",
        priority: "Normal",
        subject: "A",
        createdAt,
        incident: null,
        assignedAdmin: null,
        participants: [],
        messages: [],
      },
      {
        id: "c1",
        reference: "SC-1",
        type: "CitizenSupport",
        category: "Other",
        status: "Open",
        priority: "Normal",
        subject: "B",
        createdAt: new Date("2026-08-02T08:00:00.000Z"),
        incident: null,
        assignedAdmin: null,
        participants: [],
        messages: [],
      },
    ]);
    const page = await service.list(admin, { limit: "1" });
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe(encodeDateIdCursor(createdAt, "c2"));
  });
});
