import { ConflictException, ForbiddenException } from "@nestjs/common";
import { AdminRoleName } from "@the-eye/shared";
import { WatchOwnershipService } from "../watch-ownership.service";
import { canViewWatchSensitiveFields, maskImei } from "../watch-fleet-scope";

const adminActor = {
  typ: "admin" as const,
  sub: "admin-1",
  role: AdminRoleName.SuperAdmin,
  country: "Nigeria",
  state: "Lagos",
  lga: "Ikeja",
};

function buildOwnershipService() {
  const device = {
    id: "dev-uuid",
    deviceId: "EYE-WATCH-001",
    userId: null,
    currentOwnerType: "UNASSIGNED_INVENTORY",
    currentOwnerId: null,
    currentAssigneeId: null,
    ownershipStatus: "UNASSIGNED_INVENTORY",
    assignmentStatus: "UNASSIGNED",
  };
  const tx = {
    watchOwnershipRecord: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      create: jest.fn(),
    },
    watchAssignmentRecord: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      create: jest.fn(),
    },
    watchTransferRecord: { create: jest.fn().mockResolvedValue({ id: "transfer-1" }) },
    smartwatchDevice: {
      update: jest.fn().mockImplementation(async () => ({ ...device, currentOwnerType: "PERSON" })),
    },
  };
  const prisma = {
    smartwatchDevice: {
      findFirst: jest.fn().mockResolvedValue(device),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue(device),
      update: jest.fn(),
    },
    watchOwnershipRecord: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "ownership-1" }),
    },
    watchTransferRecord: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  } as any;
  const audit = { record: jest.fn().mockResolvedValue({ id: "audit-1" }) };
  return { service: new WatchOwnershipService(prisma, audit as never), prisma, tx, audit, device };
}

describe("WatchOwnershipService", () => {
  it("assigns unassigned inventory watch to a person", async () => {
    const { service, tx } = buildOwnershipService();
    const result = await service.assignDevice(adminActor, {
      deviceId: "EYE-WATCH-001",
      ownerType: "PERSON",
      ownerPersonId: "person-1",
      reason: "Initial assignment",
    });
    expect(result.data != null).toBe(true);
    expect(tx.watchOwnershipRecord.create).toHaveBeenCalled();
    expect(tx.watchAssignmentRecord.create).toHaveBeenCalled();
  });

  it("assigns organization-owned watch to assignee person", async () => {
    const { service, prisma } = buildOwnershipService();
    prisma.smartwatchDevice.findFirst.mockResolvedValue({
      id: "dev-uuid",
      deviceId: "EYE-WATCH-002",
      currentOwnerType: "ORGANIZATION",
      currentOwnerId: "org-1",
      ownershipStatus: "ORGANIZATION_OWNED",
    });
    await service.assignDevice(adminActor, {
      deviceId: "EYE-WATCH-002",
      ownerType: "ORGANIZATION",
      ownerOrganizationId: "org-1",
      assigneePersonId: "employee-1",
      departmentId: "dept-1",
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("rejects duplicate active ownership to same person", async () => {
    const { service, prisma } = buildOwnershipService();
    prisma.smartwatchDevice.findFirst.mockResolvedValue({
      id: "dev-uuid",
      deviceId: "EYE-WATCH-003",
      ownershipStatus: "PERSON_OWNED",
    });
    prisma.watchOwnershipRecord.findFirst.mockResolvedValue({
      id: "own-1",
      ownerPersonId: "person-1",
      validTo: null,
    });
    await expect(
      service.assignDevice(adminActor, {
        deviceId: "EYE-WATCH-003",
        ownerType: "PERSON",
        ownerPersonId: "person-1",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("blocks reassignment for lost or stolen devices", async () => {
    const { service, prisma } = buildOwnershipService();
    prisma.smartwatchDevice.findFirst.mockResolvedValue({
      id: "dev-uuid",
      deviceId: "EYE-WATCH-004",
      ownershipStatus: "LOST_OR_STOLEN",
    });
    await expect(
      service.transferDevice(adminActor, {
        deviceId: "EYE-WATCH-004",
        toOwnerType: "PERSON",
        toOwnerPersonId: "person-2",
        idempotencyKey: "key-1",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("returns idempotent transfer when idempotency key exists", async () => {
    const { service, prisma } = buildOwnershipService();
    const existing = { id: "transfer-existing" };
    prisma.watchTransferRecord.findUnique.mockResolvedValue(existing);
    const result = await service.transferDevice(adminActor, {
      deviceId: "EYE-WATCH-001",
      toOwnerType: "PERSON",
      toOwnerPersonId: "person-1",
      idempotencyKey: "dup-key",
    });
    expect((result as { idempotent?: boolean }).idempotent).toBe(true);
    expect(result.data).toEqual(existing);
  });

  it("requires admin for ownership history", async () => {
    const { service } = buildOwnershipService();
    await expect(
      service.ownershipHistory("EYE-WATCH-001", { typ: "user", sub: "u1" } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("marks device as replacement pending with audit trail", async () => {
    const { service, prisma, audit } = buildOwnershipService();
    prisma.smartwatchDevice.update = jest.fn().mockResolvedValue({
      id: "dev-uuid",
      deviceId: "EYE-WATCH-001",
      ownershipStatus: "REPLACEMENT_PENDING",
    });
    const result = await service.markReplacementPending(adminActor, "EYE-WATCH-001", {
      reason: "Screen failure",
      reportedFault: "Display dead",
      priority: "HIGH",
    });
    expect(result.data != null).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "watch.replacement.requested" }),
    );
  });
});

describe("watch-fleet-scope", () => {
  it("masks IMEI for restricted roles", () => {
    expect(canViewWatchSensitiveFields({ typ: "admin", sub: "1", role: AdminRoleName.OversightAuditor })).toBe(false);
    expect(maskImei("356938035643809", false)).toBe("3569…3809");
    expect(maskImei("356938035643809", true)).toBe("356938035643809");
  });
});
