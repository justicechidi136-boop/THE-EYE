import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { canApproveFieldDevices, FieldShiftStatus, OfficerOperationalStatus } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { EndFieldShiftDto, StartFieldShiftDto } from "./dto/field-workflows.dto";
import { assertFieldSession, decimalOrNull } from "./field-session.util";

@Injectable()
export class FieldShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getActiveShift(actor: JwtPayload) {
    const ctx = assertFieldSession(actor);
    const shift = await this.prisma.fieldShift.findFirst({
      where: {
        officerId: ctx.officerId,
        status: { in: [FieldShiftStatus.PendingApproval, FieldShiftStatus.Active, FieldShiftStatus.Paused] },
      },
      include: { assignedUnit: true, agency: true },
      orderBy: { createdAt: "desc" },
    });
    return { data: shift ? this.mapShift(shift) : null };
  }

  async startShift(actor: JwtPayload, dto: StartFieldShiftDto) {
    const ctx = assertFieldSession(actor);
    if (!ctx.agencyId) throw new ForbiddenException("Officer agency is required to start a shift");

    const existing = await this.prisma.fieldShift.findFirst({
      where: {
        officerId: ctx.officerId,
        status: { in: [FieldShiftStatus.PendingApproval, FieldShiftStatus.Active, FieldShiftStatus.Paused] },
      },
    });
    if (existing) throw new ConflictException("An active shift already exists");

    if (dto.clientActionId) {
      const duplicate = await this.prisma.fieldShift.findUnique({ where: { clientActionId: dto.clientActionId } });
      if (duplicate) return { data: this.mapShift(duplicate) };
    }

    const requiresApproval = dto.requiresSupervisorApproval ?? false;
    const status = requiresApproval ? FieldShiftStatus.PendingApproval : FieldShiftStatus.Active;
    const now = new Date();

    const shift = await this.prisma.fieldShift.create({
      data: {
        officerId: ctx.officerId,
        fieldDeviceId: ctx.fieldDeviceId,
        agencyId: ctx.agencyId,
        assignedUnitId: ctx.assignedUnitId ?? null,
        vehicleIdentifier: dto.vehicleIdentifier?.trim() || null,
        status,
        requiresSupervisorApproval: requiresApproval,
        startedAt: status === FieldShiftStatus.Active ? now : null,
        startLatitude: decimalOrNull(dto.latitude),
        startLongitude: decimalOrNull(dto.longitude),
        clientActionId: dto.clientActionId ?? null,
      },
      include: { assignedUnit: true, agency: true },
    });

    await this.upsertOfficerStatus(ctx, {
      status: status === FieldShiftStatus.Active ? OfficerOperationalStatus.OnShift : OfficerOperationalStatus.OffDuty,
      fieldShiftId: shift.id,
      vehicleIdentifier: shift.vehicleIdentifier,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });

    await this.audit.record({
      actor,
      action: "field.shift.started",
      entityType: "field_shifts",
      entityId: shift.id,
      metadata: { status, requiresApproval },
    });

    return { data: this.mapShift(shift) };
  }

  async pauseShift(actor: JwtPayload) {
    const ctx = assertFieldSession(actor);
    const shift = await this.requireActiveShift(ctx.officerId);
    if (shift.status !== FieldShiftStatus.Active) throw new BadRequestException("Only active shifts can be paused");

    const updated = await this.prisma.fieldShift.update({
      where: { id: shift.id },
      data: { status: FieldShiftStatus.Paused, pausedAt: new Date() },
      include: { assignedUnit: true, agency: true },
    });
    await this.upsertOfficerStatus(ctx, { status: OfficerOperationalStatus.OnBreak, fieldShiftId: shift.id });
    return { data: this.mapShift(updated) };
  }

  async resumeShift(actor: JwtPayload) {
    const ctx = assertFieldSession(actor);
    const shift = await this.requireActiveShift(ctx.officerId);
    if (shift.status !== FieldShiftStatus.Paused) throw new BadRequestException("Shift is not paused");

    const updated = await this.prisma.fieldShift.update({
      where: { id: shift.id },
      data: { status: FieldShiftStatus.Active, resumedAt: new Date(), pausedAt: null },
      include: { assignedUnit: true, agency: true },
    });
    await this.upsertOfficerStatus(ctx, { status: OfficerOperationalStatus.OnShift, fieldShiftId: shift.id });
    return { data: this.mapShift(updated) };
  }

  async endShift(actor: JwtPayload, dto: EndFieldShiftDto = {}) {
    const ctx = assertFieldSession(actor);
    const shift = await this.requireActiveShift(ctx.officerId);

    const updated = await this.prisma.fieldShift.update({
      where: { id: shift.id },
      data: {
        status: FieldShiftStatus.Ended,
        endedAt: new Date(),
        endLatitude: decimalOrNull(dto.latitude),
        endLongitude: decimalOrNull(dto.longitude),
      },
      include: { assignedUnit: true, agency: true },
    });

    await this.prisma.patrolSession.updateMany({
      where: { fieldShiftId: shift.id, status: { in: ["Active", "Paused"] } },
      data: { status: "Ended", endedAt: new Date() },
    });
    await this.prisma.checkpointSession.updateMany({
      where: { fieldShiftId: shift.id, status: { in: ["Active", "Paused"] } },
      data: { status: "Ended", endedAt: new Date() },
    });

    await this.upsertOfficerStatus(ctx, {
      status: OfficerOperationalStatus.OffDuty,
      fieldShiftId: null,
      patrolSessionId: null,
      checkpointSessionId: null,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });

    await this.audit.record({
      actor,
      action: "field.shift.ended",
      entityType: "field_shifts",
      entityId: shift.id,
    });

    return { data: this.mapShift(updated) };
  }

  async approveShift(id: string, actor: JwtPayload, note?: string) {
    if (actor.typ !== "admin" || !canApproveFieldDevices(actor.role ?? "")) {
      throw new ForbiddenException("Supervisor approval required");
    }
    const shift = await this.prisma.fieldShift.findUnique({ where: { id }, include: { agency: true } });
    if (!shift) throw new NotFoundException("Shift not found");
    if (shift.status !== FieldShiftStatus.PendingApproval) throw new BadRequestException("Shift is not pending approval");
    if (actor.agencyId && actor.agencyId !== shift.agencyId) throw new ForbiddenException("Shift outside agency scope");

    const updated = await this.prisma.fieldShift.update({
      where: { id },
      data: {
        status: FieldShiftStatus.Active,
        approvedById: actor.sub,
        approvedAt: new Date(),
        startedAt: new Date(),
        supervisorNote: note?.trim() || null,
      },
      include: { assignedUnit: true, agency: true },
    });

    await this.upsertOfficerStatus(
      { officerId: shift.officerId, fieldDeviceId: shift.fieldDeviceId, agencyId: shift.agencyId },
      { status: OfficerOperationalStatus.OnShift, fieldShiftId: shift.id },
    );

    return { data: this.mapShift(updated) };
  }

  private async requireActiveShift(officerId: string) {
    const shift = await this.prisma.fieldShift.findFirst({
      where: {
        officerId,
        status: { in: [FieldShiftStatus.PendingApproval, FieldShiftStatus.Active, FieldShiftStatus.Paused] },
      },
    });
    if (!shift) throw new BadRequestException("No active shift found");
    if (shift.status === FieldShiftStatus.PendingApproval) {
      throw new BadRequestException("Shift pending supervisor approval");
    }
    return shift;
  }

  private async upsertOfficerStatus(
    ctx: { officerId: string; fieldDeviceId: string; agencyId?: string },
    patch: {
      status: OfficerOperationalStatus;
      fieldShiftId?: string | null;
      patrolSessionId?: string | null;
      checkpointSessionId?: string | null;
      vehicleIdentifier?: string | null;
      latitude?: number;
      longitude?: number;
    },
  ) {
    await this.prisma.officerStatus.upsert({
      where: { officerId: ctx.officerId },
      create: {
        officerId: ctx.officerId,
        fieldDeviceId: ctx.fieldDeviceId,
        fieldShiftId: patch.fieldShiftId ?? null,
        patrolSessionId: patch.patrolSessionId ?? null,
        checkpointSessionId: patch.checkpointSessionId ?? null,
        status: patch.status,
        vehicleIdentifier: patch.vehicleIdentifier ?? null,
        latitude: decimalOrNull(patch.latitude),
        longitude: decimalOrNull(patch.longitude),
        locationAt: patch.latitude != null ? new Date() : null,
        lastHeartbeatAt: new Date(),
      },
      update: {
        fieldDeviceId: ctx.fieldDeviceId,
        fieldShiftId: patch.fieldShiftId === undefined ? undefined : patch.fieldShiftId,
        patrolSessionId: patch.patrolSessionId === undefined ? undefined : patch.patrolSessionId,
        checkpointSessionId: patch.checkpointSessionId === undefined ? undefined : patch.checkpointSessionId,
        status: patch.status,
        vehicleIdentifier: patch.vehicleIdentifier === undefined ? undefined : patch.vehicleIdentifier,
        latitude: patch.latitude === undefined ? undefined : decimalOrNull(patch.latitude),
        longitude: patch.longitude === undefined ? undefined : decimalOrNull(patch.longitude),
        locationAt: patch.latitude != null ? new Date() : undefined,
        lastHeartbeatAt: new Date(),
      },
    });
  }

  mapShift(shift: any) {
    return {
      id: shift.id,
      status: shift.status,
      officerId: shift.officerId,
      fieldDeviceId: shift.fieldDeviceId,
      agencyId: shift.agencyId,
      assignedUnitId: shift.assignedUnitId,
      assignedUnit: shift.assignedUnit
        ? { id: shift.assignedUnit.id, unitIdentifier: shift.assignedUnit.unitIdentifier, status: shift.assignedUnit.status }
        : null,
      agency: shift.agency ? { id: shift.agency.id, name: shift.agency.name, type: shift.agency.type } : null,
      vehicleIdentifier: shift.vehicleIdentifier,
      requiresSupervisorApproval: shift.requiresSupervisorApproval,
      approvedAt: shift.approvedAt?.toISOString?.() ?? shift.approvedAt ?? null,
      startedAt: shift.startedAt?.toISOString?.() ?? shift.startedAt ?? null,
      pausedAt: shift.pausedAt?.toISOString?.() ?? shift.pausedAt ?? null,
      endedAt: shift.endedAt?.toISOString?.() ?? shift.endedAt ?? null,
      startLatitude: shift.startLatitude != null ? Number(shift.startLatitude) : null,
      startLongitude: shift.startLongitude != null ? Number(shift.startLongitude) : null,
      metadata: shift.metadata ?? {},
    };
  }
}
