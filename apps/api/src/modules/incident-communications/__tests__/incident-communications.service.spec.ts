import { BadRequestException, NotFoundException } from "@nestjs/common";
import { IncidentCommunicationsService } from "../incident-communications.service";
import { IncidentCommunicationsAccessService } from "../incident-communications-access.service";

function createService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    incidentConversation: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    incidentMessage: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    incidentMessageReceipt: {
      count: jest.fn(),
      updateMany: jest.fn(),
      createMany: jest.fn(),
    },
    incidentInformationRequest: {
      create: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
    incident: { findUnique: jest.fn() },
    adminUser: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
  const access = {
    assertAccess: jest.fn(),
    canSendMessageType: jest.fn().mockReturnValue(true),
  };
  const audit = { record: jest.fn() };
  const notifications = { create: jest.fn() };
  const service = Object.create(IncidentCommunicationsService.prototype) as IncidentCommunicationsService;
  Object.assign(service, { prisma, access, audit, notifications });
  return { service, prisma, access, audit, notifications };
}

describe("IncidentCommunicationsService", () => {
  const reporter = { typ: "user" as const, sub: "user-1", role: "Citizen", permissions: ["incident:read"] };
  const ctx = {
    role: "Reporter" as const,
    canRead: true,
    canWrite: true,
    canReadInternal: false,
    canModerate: false,
    senderRole: "Reporter",
    displayLabel: "You",
    incident: {
      id: "inc-1",
      reporterId: "user-1",
      status: "Active",
      assignedAgencyId: null,
      country: "NG",
      state: "LA",
      lga: "Ikeja",
      metadata: {},
    },
  };

  it("creates conversation on first access", async () => {
    const { service, prisma, access } = createService();
    access.assertAccess.mockResolvedValue(ctx);
    prisma.incidentConversation.findUnique.mockResolvedValue(null);
    prisma.incidentConversation.create.mockResolvedValue({
      id: "conv-1",
      incidentId: "inc-1",
      status: "Active",
      version: 1,
      lastMessageAt: null,
      closedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.incidentMessage.count.mockResolvedValue(0);
    prisma.incidentInformationRequest.count.mockResolvedValue(0);
    prisma.incidentMessage.findFirst.mockResolvedValue(null);
    const result = await service.getConversation("inc-1", reporter);
    expect(result.data.id).toBe("conv-1");
    expect(prisma.incidentConversation.create).toHaveBeenCalled();
  });

  it("deduplicates messages by clientMessageId", async () => {
    const { service, prisma, access } = createService();
    access.assertAccess.mockResolvedValue(ctx);
    prisma.incidentConversation.findUnique.mockResolvedValue({
      id: "conv-1",
      status: "Active",
    });
    prisma.incidentMessage.findFirst.mockResolvedValue({
      id: "msg-existing",
      messageType: "Text",
      body: "Hello",
      senderRole: "Reporter",
      attachmentId: null,
      structuredAction: null,
      replyToMessageId: null,
      clientMessageId: "client-1",
      moderationStatus: "Approved",
      metadata: {},
      createdAt: new Date(),
      editedAt: null,
    });
    const result = await service.sendMessage("inc-1", reporter, {
      clientMessageId: "client-1",
      messageType: "Text",
      body: "Hello",
    });
    expect(result.duplicate).toBe(true);
    expect(prisma.incidentMessage.create).not.toHaveBeenCalled();
  });

  it("blocks reporter send when conversation is closed", async () => {
    const { service, prisma, access } = createService();
    access.assertAccess.mockResolvedValue(ctx);
    prisma.incidentConversation.findUnique.mockResolvedValue({
      id: "conv-1",
      status: "Closed",
    });
    await expect(
      service.sendMessage("inc-1", reporter, {
        clientMessageId: "client-2",
        messageType: "Text",
        body: "Late message",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("marks message read and audits", async () => {
    const { service, prisma, access, audit } = createService();
    access.assertAccess.mockResolvedValue(ctx);
    prisma.incidentMessage.findFirst.mockResolvedValue({ id: "msg-1", incidentId: "inc-1" });
    prisma.incidentMessageReceipt.updateMany.mockResolvedValue({ count: 1 });
    const result = await service.markRead("inc-1", "msg-1", reporter);
    expect(result.data.messageId).toBe("msg-1");
    expect(audit.record).toHaveBeenCalled();
  });

  it("returns 404 when access denied on list", async () => {
    const { service, access } = createService();
    access.assertAccess.mockRejectedValue(new NotFoundException());
    await expect(service.listMessages("inc-1", reporter, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it("notifies dispatch operators when reporter sends a message", async () => {
    const { service, prisma, access, notifications } = createService();
    access.assertAccess.mockResolvedValue(ctx);
    prisma.incidentConversation.findUnique.mockResolvedValue({
      id: "conv-1",
      status: "Active",
    });
    prisma.incidentMessage.findFirst.mockResolvedValue(null);
    prisma.incidentMessage.create.mockResolvedValue({
      id: "msg-1",
      messageType: "Text",
      body: "Need help",
      senderRole: "Reporter",
      attachmentId: null,
      structuredAction: null,
      replyToMessageId: null,
      clientMessageId: "client-1",
      moderationStatus: "Approved",
      metadata: {},
      createdAt: new Date(),
      editedAt: null,
    });
    prisma.incidentConversation.update.mockResolvedValue({});
    prisma.incident.findUnique.mockResolvedValue({
      reporterId: "user-1",
      status: "Verified",
      assignedAgencyId: "agency-1",
    });
    prisma.adminUser.findMany.mockImplementation(async (args: { where?: Record<string, unknown> }) => {
      if (args.where && "agencyId" in args.where) {
        return [{ id: "agency-admin-1" }];
      }
      return [{ id: "dispatcher-1" }];
    });
    prisma.incidentMessageReceipt.createMany.mockResolvedValue({ count: 2 });
    prisma.incidentInformationRequest.updateMany.mockResolvedValue({ count: 0 });
    prisma.incidentInformationRequest.findFirst.mockResolvedValue(null);

    await service.sendMessage("inc-1", reporter, {
      clientMessageId: "client-1",
      messageType: "Text",
      body: "Need help",
    });

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: "agency-admin-1",
        type: "IncidentMessageReceived",
      }),
      undefined,
    );
  });

  it("expires stale information requests when building summary", async () => {
    const { service, prisma, access } = createService();
    access.assertAccess.mockResolvedValue(ctx);
    prisma.incidentConversation.findUnique.mockResolvedValue({
      id: "conv-1",
      incidentId: "inc-1",
      status: "Active",
      version: 1,
      lastMessageAt: null,
      closedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.incidentInformationRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.incidentMessageReceipt.count.mockResolvedValue(0);
    prisma.incidentMessage.findFirst.mockResolvedValue(null);
    prisma.incidentInformationRequest.count.mockResolvedValue(0);
    await service.getConversation("inc-1", reporter);
    expect(prisma.incidentInformationRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ conversationId: "conv-1", status: "Open" }),
        data: { status: "Expired" },
      }),
    );
  });
});
