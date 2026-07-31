import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  WatchAssignmentStatus,
  WatchInventoryStatus,
  WatchOwnerType,
  WatchOwnershipStatus,
  WATCH_OWNERSHIP_BLOCKED_STATUSES,
} from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";

export type AssignWatchDto = {
  deviceId: string;
  ownerType: "PERSON" | "ORGANIZATION";
  ownerPersonId?: string;
  ownerOrganizationId?: string;
  assigneePersonId?: string;
  departmentId?: string;
  reason?: string;
  idempotencyKey?: string;
};

export type TransferWatchDto = {
  deviceId: string;
  toOwnerType: "PERSON" | "ORGANIZATION" | "UNASSIGNED_INVENTORY";
  toOwnerPersonId?: string;
  toOwnerOrganizationId?: string;
  toAssigneePersonId?: string;
  toDepartmentId?: string;
  toInventoryLocationId?: string;
  reason?: string;
  idempotencyKey: string;
};

@Injectable()
export class WatchOwnershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async registerInventoryDevice(
    actor: JwtPayload,
    dto: {
      deviceId: string;
      serialNumber?: string;
      imei?: string;
      eid?: string;
      model?: string;
      manufacturer?: string;
      inventoryLocationId?: string;
      provider?: string;
    },
  ) {
    this.assertAdmin(actor);
    const now = new Date();
    const locationId = dto.inventoryLocationId ?? null;

    const device = await this.prisma.smartwatchDevice.create({
      data: {
        deviceId: dto.deviceId,
        serialNumber: dto.serialNumber,
        imei: dto.imei,
        eid: dto.eid,
        model: dto.model,
        manufacturer: dto.manufacturer,
        provider: dto.provider ?? "THE_EYE",
        currentOwnerType: WatchOwnerType.UnassignedInventory,
        ownershipStatus: WatchOwnershipStatus.UnassignedInventory,
        assignmentStatus: WatchAssignmentStatus.Unassigned,
        inventoryStatus: WatchInventoryStatus.InStock,
        currentInventoryLocationId: locationId,
      } as never,
    });

    await (this.prisma as any).watchOwnershipRecord.create({
      data: {
        deviceId: device.id,
        ownerType: WatchOwnerType.UnassignedInventory,
        inventoryLocationId: locationId,
        ownershipStatus: WatchOwnershipStatus.UnassignedInventory,
        validFrom: now,
        actorAdminId: actor.sub,
        correlationId: `inv-${device.id}-${now.getTime()}`,
      },
    });

    await this.audit.record({
      actor,
      action: "watch.inventory.registered",
      entityType: "smartwatch_devices",
      entityId: device.id,
      metadata: { deviceId: dto.deviceId, inventoryLocationId: locationId },
    });

    return { data: device };
  }

  async assignDevice(actor: JwtPayload, dto: AssignWatchDto, ipAddress?: string) {
    this.assertAdmin(actor);
    if (dto.idempotencyKey) {
      const existing = await (this.prisma as any).watchTransferRecord.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) return { data: existing, idempotent: true };
    }

    const device = await this.findDeviceOrThrow(dto.deviceId);
    this.assertNotBlocked(device);

    const activeOwnership = await (this.prisma as any).watchOwnershipRecord.findFirst({
      where: { deviceId: device.id, validTo: null },
      orderBy: { validFrom: "desc" },
    });
    if (activeOwnership && dto.ownerType === "PERSON" && activeOwnership.ownerPersonId === dto.ownerPersonId) {
      throw new ConflictException("Device already actively owned by this person");
    }

    const now = new Date();
    const correlationId = dto.idempotencyKey ?? `assign-${device.id}-${now.getTime()}`;

    return this.prisma.$transaction(async (tx) => {
      if (activeOwnership) {
        await (tx as any).watchOwnershipRecord.update({
          where: { id: activeOwnership.id },
          data: { validTo: now, transferredAt: now, transferredByAdminId: actor.sub },
        });
      }

      const activeAssignment = await (tx as any).watchAssignmentRecord.findFirst({
        where: { deviceId: device.id, validTo: null },
        orderBy: { validFrom: "desc" },
      });
      if (activeAssignment) {
        await (tx as any).watchAssignmentRecord.update({
          where: { id: activeAssignment.id },
          data: { validTo: now, unassignedAt: now },
        });
      }

      const isOrg = dto.ownerType === "ORGANIZATION";
      const ownershipStatus = isOrg && dto.assigneePersonId
        ? WatchOwnershipStatus.OrganizationAssignedToPerson
        : isOrg
          ? WatchOwnershipStatus.OrganizationOwned
          : WatchOwnershipStatus.PersonOwned;

      const ownerId = isOrg ? dto.ownerOrganizationId : dto.ownerPersonId;
      if (!ownerId) throw new BadRequestException("ownerPersonId or ownerOrganizationId required");

      await (tx as any).watchOwnershipRecord.create({
        data: {
          deviceId: device.id,
          ownerType: isOrg ? WatchOwnerType.Organization : WatchOwnerType.Person,
          ownerPersonId: isOrg ? null : dto.ownerPersonId,
          ownerOrganizationId: isOrg ? dto.ownerOrganizationId : null,
          ownershipStatus,
          validFrom: now,
          previousRecordId: activeOwnership?.id ?? null,
          actorAdminId: actor.sub,
          transferReason: dto.reason,
          correlationId,
          ipAddress,
        },
      });

      if (dto.assigneePersonId || dto.ownerPersonId || isOrg) {
        await (tx as any).watchAssignmentRecord.create({
          data: {
            deviceId: device.id,
            organizationId: isOrg ? dto.ownerOrganizationId : null,
            departmentId: dto.departmentId ?? null,
            assigneePersonId: dto.assigneePersonId ?? (isOrg ? null : dto.ownerPersonId),
            assignmentStatus: WatchAssignmentStatus.Assigned,
            validFrom: now,
            assignedAt: now,
            assignedByAdminId: actor.sub,
            reason: dto.reason,
            correlationId,
          },
        });
      }

      const updated = await tx.smartwatchDevice.update({
        where: { id: device.id },
        data: {
          userId: dto.assigneePersonId ?? dto.ownerPersonId ?? device.userId,
          currentOwnerType: isOrg ? WatchOwnerType.Organization : WatchOwnerType.Person,
          currentOwnerId: ownerId,
          currentAssigneeId: dto.assigneePersonId ?? dto.ownerPersonId ?? null,
          currentOrganizationId: isOrg ? dto.ownerOrganizationId : null,
          currentDepartmentId: dto.departmentId ?? null,
          currentInventoryLocationId: null,
          ownershipStatus,
          assignmentStatus: WatchAssignmentStatus.Assigned,
          inventoryStatus: WatchInventoryStatus.Deployed,
        } as never,
      });

      await this.audit.record({
        actor,
        action: "watch.device.assigned",
        entityType: "smartwatch_devices",
        entityId: device.id,
        metadata: { ...dto, correlationId },
        ipAddress,
      });

      return { data: updated, correlationId };
    });
  }

  async transferDevice(actor: JwtPayload, dto: TransferWatchDto, ipAddress?: string) {
    this.assertAdmin(actor);
    const existing = await (this.prisma as any).watchTransferRecord.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) return { data: existing, idempotent: true };

    const device = await this.findDeviceOrThrow(dto.deviceId);
    this.assertNotBlocked(device);

    const now = new Date();
    const fromOwnerType = device.currentOwnerType;
    const fromOwnerId = device.currentOwnerId;
    const fromAssigneeId = device.currentAssigneeId;

    return this.prisma.$transaction(async (tx) => {
      const transfer = await (tx as any).watchTransferRecord.create({
        data: {
          deviceId: device.id,
          fromOwnerType,
          fromOwnerId,
          toOwnerType: dto.toOwnerType,
          toOwnerId: dto.toOwnerPersonId ?? dto.toOwnerOrganizationId ?? null,
          fromAssigneeId,
          toAssigneeId: dto.toAssigneePersonId ?? null,
          transferredByAdminId: actor.sub,
          transferReason: dto.reason,
          correlationId: dto.idempotencyKey,
          idempotencyKey: dto.idempotencyKey,
          ipAddress,
        },
      });

      const activeOwnership = await (tx as any).watchOwnershipRecord.findFirst({
        where: { deviceId: device.id, validTo: null },
        orderBy: { validFrom: "desc" },
      });
      if (activeOwnership) {
        await (tx as any).watchOwnershipRecord.update({
          where: { id: activeOwnership.id },
          data: { validTo: now, transferredAt: now, transferredByAdminId: actor.sub },
        });
      }

      let ownershipStatus: string = WatchOwnershipStatus.Transferred;
      let ownerType = dto.toOwnerType;
      let inventoryStatus: string = WatchInventoryStatus.Deployed;

      if (dto.toOwnerType === WatchOwnerType.UnassignedInventory) {
        ownershipStatus = WatchOwnershipStatus.UnassignedInventory;
        inventoryStatus = WatchInventoryStatus.InStock;
      } else if (dto.toOwnerType === WatchOwnerType.Organization && dto.toAssigneePersonId) {
        ownershipStatus = WatchOwnershipStatus.OrganizationAssignedToPerson;
      } else if (dto.toOwnerType === WatchOwnerType.Organization) {
        ownershipStatus = WatchOwnershipStatus.OrganizationOwned;
      } else if (dto.toOwnerType === WatchOwnerType.Person) {
        ownershipStatus = WatchOwnershipStatus.PersonOwned;
      }

      await (tx as any).watchOwnershipRecord.create({
        data: {
          deviceId: device.id,
          ownerType: ownerType,
          ownerPersonId: dto.toOwnerPersonId ?? null,
          ownerOrganizationId: dto.toOwnerOrganizationId ?? null,
          inventoryLocationId: dto.toInventoryLocationId ?? null,
          ownershipStatus,
          validFrom: now,
          previousRecordId: activeOwnership?.id ?? null,
          actorAdminId: actor.sub,
          transferReason: dto.reason,
          correlationId: dto.idempotencyKey,
          ipAddress,
        },
      });

      const updated = await tx.smartwatchDevice.update({
        where: { id: device.id },
        data: {
          userId: dto.toAssigneePersonId ?? dto.toOwnerPersonId ?? null,
          currentOwnerType: ownerType,
          currentOwnerId: dto.toOwnerPersonId ?? dto.toOwnerOrganizationId ?? null,
          currentAssigneeId: dto.toAssigneePersonId ?? dto.toOwnerPersonId ?? null,
          currentOrganizationId: dto.toOwnerOrganizationId ?? null,
          currentDepartmentId: dto.toDepartmentId ?? null,
          currentInventoryLocationId: dto.toInventoryLocationId ?? null,
          ownershipStatus,
          assignmentStatus:
            dto.toAssigneePersonId || dto.toOwnerPersonId
              ? WatchAssignmentStatus.Assigned
              : WatchAssignmentStatus.Unassigned,
          inventoryStatus,
        } as never,
      });

      await this.audit.record({
        actor,
        action: "watch.device.transferred",
        entityType: "smartwatch_devices",
        entityId: device.id,
        metadata: { transferId: transfer.id, ...dto },
        ipAddress,
      });

      return { data: updated, transfer };
    });
  }

  async markLostOrStolen(actor: JwtPayload, deviceId: string, reason?: string) {
    this.assertAdmin(actor);
    const device = await this.findDeviceOrThrow(deviceId);
    const now = new Date();

    const updated = await this.prisma.smartwatchDevice.update({
      where: { id: device.id },
      data: {
        ownershipStatus: WatchOwnershipStatus.LostOrStolen,
        inventoryStatus: WatchInventoryStatus.LostOrStolen,
        isActive: false,
      } as never,
    });

    await (this.prisma as any).watchOwnershipRecord.create({
      data: {
        deviceId: device.id,
        ownerType: device.currentOwnerType,
        ownerPersonId: device.currentOwnerType === WatchOwnerType.Person ? device.currentOwnerId : null,
        ownerOrganizationId:
          device.currentOwnerType === WatchOwnerType.Organization ? device.currentOwnerId : null,
        ownershipStatus: WatchOwnershipStatus.LostOrStolen,
        validFrom: now,
        actorAdminId: actor.sub,
        transferReason: reason,
        correlationId: `lost-${device.id}-${now.getTime()}`,
      },
    });

    await this.audit.record({
      actor,
      action: "watch.device.lost_or_stolen",
      entityType: "smartwatch_devices",
      entityId: device.id,
      reason,
    });

    return { data: updated };
  }

  async returnToInventory(
    actor: JwtPayload,
    deviceId: string,
    inventoryLocationId?: string,
    reason?: string,
    idempotencyKey?: string,
  ) {
    return this.transferDevice(
      actor,
      {
        deviceId,
        toOwnerType: WatchOwnerType.UnassignedInventory,
        toInventoryLocationId: inventoryLocationId,
        reason: reason ?? "Returned to inventory",
        idempotencyKey: idempotencyKey ?? `return-${deviceId}-${Date.now()}`,
      },
    );
  }

  async restoreRecovered(actor: JwtPayload, deviceId: string, reason?: string) {
    this.assertAdmin(actor);
    const device = await this.findDeviceOrThrow(deviceId);
    if (device.ownershipStatus !== WatchOwnershipStatus.LostOrStolen) {
      throw new BadRequestException("Device is not marked lost or stolen");
    }
    const now = new Date();
    const updated = await this.prisma.smartwatchDevice.update({
      where: { id: device.id },
      data: {
        ownershipStatus: WatchOwnershipStatus.UnassignedInventory,
        inventoryStatus: WatchInventoryStatus.InStock,
        currentOwnerType: WatchOwnerType.UnassignedInventory,
        currentOwnerId: null,
        currentAssigneeId: null,
        userId: null,
        isActive: true,
      } as never,
    });
    await (this.prisma as any).watchOwnershipRecord.create({
      data: {
        deviceId: device.id,
        ownerType: WatchOwnerType.UnassignedInventory,
        ownershipStatus: WatchOwnershipStatus.UnassignedInventory,
        validFrom: now,
        actorAdminId: actor.sub,
        transferReason: reason ?? "Recovered device restored to inventory",
        correlationId: `restore-${device.id}-${now.getTime()}`,
      },
    });
    await this.audit.record({
      actor,
      action: "watch.device.restored",
      entityType: "smartwatch_devices",
      entityId: device.id,
      reason,
    });
    return { data: updated };
  }

  async markReplacementPending(
    actor: JwtPayload,
    deviceId: string,
    dto: {
      reason?: string;
      reportedFault?: string;
      priority?: string;
      replacementDeviceId?: string;
    },
  ) {
    this.assertAdmin(actor);
    const device = await this.findDeviceOrThrow(deviceId);
    this.assertNotBlocked(device);
    const now = new Date();
    const correlationId = `replacement-pending-${device.id}-${now.getTime()}`;

    const updated = await this.prisma.smartwatchDevice.update({
      where: { id: device.id },
      data: {
        ownershipStatus: WatchOwnershipStatus.ReplacementPending,
        inventoryStatus: WatchInventoryStatus.ReplacementPending,
      } as never,
    });

    await (this.prisma as any).watchOwnershipRecord.create({
      data: {
        deviceId: device.id,
        ownerType: device.currentOwnerType,
        ownerPersonId: device.currentOwnerType === WatchOwnerType.Person ? device.currentOwnerId : null,
        ownerOrganizationId:
          device.currentOwnerType === WatchOwnerType.Organization ? device.currentOwnerId : null,
        ownershipStatus: WatchOwnershipStatus.ReplacementPending,
        validFrom: now,
        actorAdminId: actor.sub,
        transferReason: dto.reason,
        correlationId,
        metadata: {
          reportedFault: dto.reportedFault,
          priority: dto.priority ?? "NORMAL",
          replacementDeviceId: dto.replacementDeviceId ?? null,
          approvalStatus: "PENDING",
          requestedByAdminId: actor.sub,
        },
      },
    });

    await this.audit.record({
      actor,
      action: "watch.replacement.requested",
      entityType: "smartwatch_devices",
      entityId: device.id,
      metadata: { ...dto, correlationId },
    });

    return { data: updated, correlationId };
  }

  async approveReplacement(actor: JwtPayload, deviceId: string, notes?: string) {
    this.assertAdmin(actor);
    const device = await this.findDeviceOrThrow(deviceId);
    if (device.ownershipStatus !== WatchOwnershipStatus.ReplacementPending) {
      throw new BadRequestException("Device is not replacement pending");
    }
    await this.audit.record({
      actor,
      action: "watch.replacement.approved",
      entityType: "smartwatch_devices",
      entityId: device.id,
      metadata: { notes },
    });
    return { data: { deviceId: device.deviceId, approvalStatus: "APPROVED" } };
  }

  async cancelReplacement(actor: JwtPayload, deviceId: string, reason?: string) {
    this.assertAdmin(actor);
    const device = await this.findDeviceOrThrow(deviceId);
    if (device.ownershipStatus !== WatchOwnershipStatus.ReplacementPending) {
      throw new BadRequestException("Device is not replacement pending");
    }
    const priorStatus =
      device.currentOwnerType === WatchOwnerType.Organization
        ? WatchOwnershipStatus.OrganizationOwned
        : WatchOwnershipStatus.PersonOwned;
    const now = new Date();
    const updated = await this.prisma.smartwatchDevice.update({
      where: { id: device.id },
      data: {
        ownershipStatus: priorStatus,
        inventoryStatus: WatchInventoryStatus.Deployed,
      } as never,
    });
    await (this.prisma as any).watchOwnershipRecord.create({
      data: {
        deviceId: device.id,
        ownerType: device.currentOwnerType,
        ownershipStatus: priorStatus,
        validFrom: now,
        actorAdminId: actor.sub,
        transferReason: reason ?? "Replacement request cancelled",
        correlationId: `replacement-cancel-${device.id}-${now.getTime()}`,
        metadata: { approvalStatus: "CANCELLED" },
      },
    });
    await this.audit.record({
      actor,
      action: "watch.replacement.cancelled",
      entityType: "smartwatch_devices",
      entityId: device.id,
      reason,
    });
    return { data: updated };
  }

  async issueReplacement(
    actor: JwtPayload,
    deviceId: string,
    dto: { replacementDeviceId: string; reason?: string },
  ) {
    this.assertAdmin(actor);
    const device = await this.findDeviceOrThrow(deviceId);
    if (device.ownershipStatus !== WatchOwnershipStatus.ReplacementPending) {
      throw new BadRequestException("Device is not replacement pending");
    }
    const replacement = await this.findDeviceOrThrow(dto.replacementDeviceId);
    const correlationId = `replacement-issued-${device.id}-${Date.now()}`;

    await this.assignDevice(actor, {
      deviceId: replacement.deviceId,
      ownerType: device.currentOwnerType === WatchOwnerType.Organization ? "ORGANIZATION" : "PERSON",
      ownerPersonId: device.currentOwnerType === WatchOwnerType.Person ? device.currentOwnerId ?? undefined : undefined,
      ownerOrganizationId:
        device.currentOwnerType === WatchOwnerType.Organization ? device.currentOwnerId ?? undefined : undefined,
      assigneePersonId: device.currentAssigneeId ?? undefined,
      reason: dto.reason ?? `Replacement for ${device.deviceId}`,
      idempotencyKey: correlationId,
    });

    await this.audit.record({
      actor,
      action: "watch.replacement.issued",
      entityType: "smartwatch_devices",
      entityId: device.id,
      metadata: { replacementDeviceId: replacement.deviceId, correlationId },
    });

    return { data: { faultyDeviceId: device.deviceId, replacementDeviceId: replacement.deviceId } };
  }

  async retireDevice(actor: JwtPayload, deviceId: string, reason?: string) {
    this.assertAdmin(actor);
    const device = await this.findDeviceOrThrow(deviceId);
    const now = new Date();

    const updated = await this.prisma.smartwatchDevice.update({
      where: { id: device.id },
      data: {
        ownershipStatus: WatchOwnershipStatus.Retired,
        inventoryStatus: WatchInventoryStatus.Retired,
        isActive: false,
      } as never,
    });

    await (this.prisma as any).watchOwnershipRecord.create({
      data: {
        deviceId: device.id,
        ownerType: device.currentOwnerType,
        ownershipStatus: WatchOwnershipStatus.Retired,
        validFrom: now,
        actorAdminId: actor.sub,
        transferReason: reason,
        correlationId: `retire-${device.id}-${now.getTime()}`,
      },
    });

    await this.audit.record({
      actor,
      action: "watch.device.retired",
      entityType: "smartwatch_devices",
      entityId: device.id,
      reason,
    });

    return { data: updated };
  }

  async ownershipHistory(deviceId: string, actor: JwtPayload) {
    this.assertAdmin(actor);
    const device = await this.findDeviceOrThrow(deviceId);
    const records = await (this.prisma as any).watchOwnershipRecord.findMany({
      where: { deviceId: device.id },
      orderBy: { validFrom: "desc" },
      take: 200,
    });
    return { data: records };
  }

  async assignmentHistory(deviceId: string, actor: JwtPayload) {
    this.assertAdmin(actor);
    const device = await this.findDeviceOrThrow(deviceId);
    const records = await (this.prisma as any).watchAssignmentRecord.findMany({
      where: { deviceId: device.id },
      orderBy: { validFrom: "desc" },
      take: 200,
    });
    return { data: records };
  }

  async transferHistory(deviceId: string, actor: JwtPayload) {
    this.assertAdmin(actor);
    const device = await this.findDeviceOrThrow(deviceId);
    const records = await (this.prisma as any).watchTransferRecord.findMany({
      where: { deviceId: device.id },
      orderBy: { transferredAt: "desc" },
      take: 200,
    });
    return { data: records };
  }

  private assertAdmin(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Admin access required");
  }

  private assertNotBlocked(device: { ownershipStatus: string }) {
    if (WATCH_OWNERSHIP_BLOCKED_STATUSES.includes(device.ownershipStatus as any)) {
      throw new ConflictException(`Device is ${device.ownershipStatus} and cannot be reassigned`);
    }
    if (device.ownershipStatus === WatchOwnershipStatus.ReplacementPending) {
      throw new ConflictException("Device has a pending replacement request");
    }
  }

  private async findDeviceOrThrow(deviceIdOrUuid: string) {
    const device = await this.prisma.smartwatchDevice.findFirst({
      where: { OR: [{ id: deviceIdOrUuid }, { deviceId: deviceIdOrUuid }] },
    });
    if (!device) throw new NotFoundException("Watch device not found");
    return device as typeof device & {
      currentOwnerType: string;
      currentOwnerId: string | null;
      currentAssigneeId: string | null;
      ownershipStatus: string;
    };
  }
}
