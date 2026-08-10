import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  FIELD_ERROR_CODES,
  FieldDeviceRegistrationStatus,
  FieldPreProvisionStatus,
  canApproveFieldDevices,
} from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { FieldDevicesService } from "./field-devices.service";
import type { FieldDeviceAdminActionDto } from "./dto/field-devices.dto";

@Injectable()
export class FieldDevicesAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly devices: FieldDevicesService,
  ) {}

  async list(actor: JwtPayload, query: { status?: string; agencyId?: string; limit?: string }) {
    this.assertSupervisor(actor);
    const limit = Math.min(Number(query.limit ?? 50), 100);
    const where = {
      ...(query.status ? { registrationStatus: query.status as never } : {}),
      ...(query.agencyId ? { agencyId: query.agencyId } : {}),
      ...(actor.role === "Super Admin" || actor.role === "Country Admin"
        ? {}
        : {
            countryCode: actor.country,
            ...(actor.role === "State Admin" ? { stateCode: actor.state } : {}),
            ...(actor.role === "LGA Admin" ? { stateCode: actor.state, lgaCode: actor.lga } : {}),
            ...(actor.role === "Agency Admin" ? { agencyId: actor.agencyId } : {}),
          }),
    };
    const rows = await this.prisma.fieldDevice.findMany({
      where,
      orderBy: { lastSeenAt: "desc" },
      take: limit,
    });
    return { data: rows.map((row) => this.devices.mapDevice(row)) };
  }

  async get(id: string, actor: JwtPayload) {
    this.assertSupervisor(actor);
    const device = await this.prisma.fieldDevice.findUnique({ where: { id } });
    if (!device) throw new NotFoundException("Device not found");
    this.assertDeviceScope(actor, device);
    return { data: this.devices.mapDevice(device) };
  }

  async approve(id: string, actor: JwtPayload, dto: FieldDeviceAdminActionDto) {
    this.assertSupervisor(actor);
    const current = await this.requireScopedDevice(id, actor);
    const finalizesPreProvisioning = current.preProvisionStatus === FieldPreProvisionStatus.AwaitingFinalApproval;
    return this.transition(id, actor, dto, FieldDeviceRegistrationStatus.Active, "field.device.approved", {
      approvedAt: new Date(),
      approvedById: actor.sub,
      assignedUserId: dto.assignedUserId,
      assignedUnitId: dto.assignedUnitId,
      requiresRePair: false,
      isLost: false,
      isRevoked: false,
      ...(finalizesPreProvisioning ? { preProvisionStatus: FieldPreProvisionStatus.Active } : {}),
    });
  }

  async reject(id: string, actor: JwtPayload, dto: FieldDeviceAdminActionDto) {
    return this.transition(id, actor, dto, FieldDeviceRegistrationStatus.Retired, "field.device.rejected", {
      revokeReason: dto.reason ?? dto.note ?? "Rejected",
    });
  }

  async suspend(id: string, actor: JwtPayload, dto: FieldDeviceAdminActionDto) {
    return this.transition(id, actor, dto, FieldDeviceRegistrationStatus.Suspended, "field.device.suspended", {});
  }

  async restore(id: string, actor: JwtPayload, dto: FieldDeviceAdminActionDto) {
    return this.transition(id, actor, dto, FieldDeviceRegistrationStatus.Active, "field.device.restored", {
      isLost: false,
      isRevoked: false,
    });
  }

  async markLost(id: string, actor: JwtPayload, dto: FieldDeviceAdminActionDto) {
    return this.transition(id, actor, dto, FieldDeviceRegistrationStatus.Lost, "field.device.marked_lost", {
      isLost: true,
      lostAt: new Date(),
      lostReason: dto.reason ?? dto.note,
    });
  }

  async revoke(id: string, actor: JwtPayload, dto: FieldDeviceAdminActionDto) {
    const result = await this.transition(id, actor, dto, FieldDeviceRegistrationStatus.Revoked, "field.device.revoked", {
      isRevoked: true,
      revokedAt: new Date(),
      revokedById: actor.sub,
      revokeReason: dto.reason ?? dto.note,
      tokenVersion: { increment: 1 },
    });
    await this.prisma.fieldDeviceSession.updateMany({
      where: { fieldDeviceId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result;
  }

  async requireRePair(id: string, actor: JwtPayload, dto: FieldDeviceAdminActionDto) {
    return this.transition(id, actor, dto, undefined, "field.device.repair_required", {
      requiresRePair: true,
      tokenVersion: { increment: 1 },
    });
  }

  async forceSignOut(id: string, actor: JwtPayload, dto: FieldDeviceAdminActionDto) {
    this.assertSupervisor(actor);
    const device = await this.requireScopedDevice(id, actor);
    await this.prisma.fieldDeviceSession.updateMany({
      where: { fieldDeviceId: device.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      actor,
      action: "field.device.force_sign_out",
      entityType: "field_device",
      entityId: device.id,
      reason: dto.reason ?? dto.note,
    });
    return { data: { signedOut: true } };
  }

  private async transition(
    id: string,
    actor: JwtPayload,
    dto: FieldDeviceAdminActionDto,
    status: FieldDeviceRegistrationStatus | undefined,
    auditAction: string,
    data: Record<string, unknown>,
  ) {
    this.assertSupervisor(actor);
    const device = await this.requireScopedDevice(id, actor);
    const updated = await this.prisma.fieldDevice.update({
      where: { id: device.id },
      data: {
        ...(status ? { registrationStatus: status } : {}),
        ...data,
      } as never,
    });
    await this.audit.record({
      actor,
      action: auditAction,
      entityType: "field_device",
      entityId: device.id,
      reason: dto.reason ?? dto.note,
      metadata: { assignedUserId: dto.assignedUserId, assignedUnitId: dto.assignedUnitId },
    });
    return { data: this.devices.mapDevice(updated) };
  }

  /** Public: reused by field-device-preprovision.service.ts and field-device-pairing.service.ts. */
  assertSupervisor(actor: JwtPayload) {
    if (!canApproveFieldDevices(actor.role ?? "")) {
      throw new ForbiddenException({ code: FIELD_ERROR_CODES.JURISDICTION_MISMATCH, message: "Supervisor scope required" });
    }
  }

  /** Public: reused by field-device-preprovision.service.ts and field-device-pairing.service.ts. */
  assertDeviceScope(
    actor: JwtPayload,
    device: { countryCode: string | null; stateCode: string | null; lgaCode: string | null; agencyId: string | null },
  ) {
    if (actor.role === "Super Admin" || actor.role === "Country Admin") return;
    if (actor.role === "State Admin" && device.stateCode === actor.state) return;
    if (actor.role === "LGA Admin" && device.stateCode === actor.state && device.lgaCode === actor.lga) return;
    if (actor.role === "Agency Admin" && device.agencyId === actor.agencyId) return;
    throw new ForbiddenException({ code: FIELD_ERROR_CODES.JURISDICTION_MISMATCH, message: "Out of scope" });
  }

  /** Public: reused by field-device-preprovision.service.ts and field-device-pairing.service.ts. */
  async requireScopedDevice(id: string, actor: JwtPayload) {
    const device = await this.prisma.fieldDevice.findUnique({ where: { id } });
    if (!device) throw new NotFoundException("Device not found");
    this.assertDeviceScope(actor, device);
    return device;
  }
}
