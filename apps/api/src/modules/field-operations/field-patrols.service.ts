import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { FieldShiftStatus, OfficerOperationalStatus, PatrolSessionStatus } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { PatrolLocationDto, StartPatrolSessionDto } from "./dto/field-workflows.dto";
import { assertFieldSession, decimalOrNull } from "./field-session.util";

@Injectable()
export class FieldPatrolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getActivePatrol(actor: JwtPayload) {
    const ctx = assertFieldSession(actor);
    const patrol = await this.prisma.patrolSession.findFirst({
      where: { officerId: ctx.officerId, status: { in: [PatrolSessionStatus.Active, PatrolSessionStatus.Paused] } },
      orderBy: { startedAt: "desc" },
    });
    return { data: patrol ? this.mapPatrol(patrol) : null };
  }

  async startPatrol(actor: JwtPayload, dto: StartPatrolSessionDto) {
    const ctx = assertFieldSession(actor);
    const shift = await this.requireActiveShift(ctx.officerId);

    const activeCheckpoint = await this.prisma.checkpointSession.findFirst({
      where: { officerId: ctx.officerId, status: { in: ["Active", "Paused"] } },
    });
    if (activeCheckpoint) throw new ConflictException("End checkpoint session before starting patrol");

    const existing = await this.prisma.patrolSession.findFirst({
      where: { officerId: ctx.officerId, status: { in: [PatrolSessionStatus.Active, PatrolSessionStatus.Paused] } },
    });
    if (existing) throw new ConflictException("Patrol session already active");

    if (dto.clientActionId) {
      const duplicate = await this.prisma.patrolSession.findUnique({ where: { clientActionId: dto.clientActionId } });
      if (duplicate) return { data: this.mapPatrol(duplicate) };
    }

    const patrol = await this.prisma.patrolSession.create({
      data: {
        fieldShiftId: shift.id,
        officerId: ctx.officerId,
        fieldDeviceId: ctx.fieldDeviceId,
        agencyId: shift.agencyId,
        assignedUnitId: shift.assignedUnitId,
        patrolZoneLabel: dto.patrolZoneLabel?.trim() || null,
        status: PatrolSessionStatus.Active,
        lastLatitude: decimalOrNull(dto.latitude),
        lastLongitude: decimalOrNull(dto.longitude),
        lastLocationAt: dto.latitude != null ? new Date() : null,
        clientActionId: dto.clientActionId ?? null,
      },
    });

    await this.prisma.officerStatus.upsert({
      where: { officerId: ctx.officerId },
      create: {
        officerId: ctx.officerId,
        fieldDeviceId: ctx.fieldDeviceId,
        fieldShiftId: shift.id,
        patrolSessionId: patrol.id,
        status: OfficerOperationalStatus.OnPatrol,
        lastHeartbeatAt: new Date(),
      },
      update: {
        patrolSessionId: patrol.id,
        checkpointSessionId: null,
        status: OfficerOperationalStatus.OnPatrol,
        lastHeartbeatAt: new Date(),
      },
    });

    await this.audit.record({
      actor,
      action: "field.patrol.started",
      entityType: "patrol_sessions",
      entityId: patrol.id,
    });

    return { data: this.mapPatrol(patrol) };
  }

  async pausePatrol(actor: JwtPayload) {
    const ctx = assertFieldSession(actor);
    const patrol = await this.requireActivePatrol(ctx.officerId);
    const updated = await this.prisma.patrolSession.update({
      where: { id: patrol.id },
      data: { status: PatrolSessionStatus.Paused, pausedAt: new Date() },
    });
    return { data: this.mapPatrol(updated) };
  }

  async resumePatrol(actor: JwtPayload) {
    const ctx = assertFieldSession(actor);
    const patrol = await this.requireActivePatrol(ctx.officerId);
    if (patrol.status !== PatrolSessionStatus.Paused) throw new BadRequestException("Patrol is not paused");
    const updated = await this.prisma.patrolSession.update({
      where: { id: patrol.id },
      data: { status: PatrolSessionStatus.Active, pausedAt: null },
    });
    return { data: this.mapPatrol(updated) };
  }

  async endPatrol(actor: JwtPayload) {
    const ctx = assertFieldSession(actor);
    const patrol = await this.requireActivePatrol(ctx.officerId);
    const updated = await this.prisma.patrolSession.update({
      where: { id: patrol.id },
      data: { status: PatrolSessionStatus.Ended, endedAt: new Date() },
    });

    await this.prisma.officerStatus.updateMany({
      where: { officerId: ctx.officerId, patrolSessionId: patrol.id },
      data: { patrolSessionId: null, status: OfficerOperationalStatus.OnShift },
    });

    await this.audit.record({
      actor,
      action: "field.patrol.ended",
      entityType: "patrol_sessions",
      entityId: patrol.id,
    });

    return { data: this.mapPatrol(updated) };
  }

  async recordLocation(actor: JwtPayload, dto: PatrolLocationDto) {
    const ctx = assertFieldSession(actor);
    const patrol = await this.requireActivePatrol(ctx.officerId);
    const route = Array.isArray(patrol.routeRecording) ? [...patrol.routeRecording] : [];
    route.push({
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracyMeters: dto.accuracyMeters ?? null,
      recordedAt: dto.recordedAt ?? new Date().toISOString(),
      clientActionId: dto.clientActionId ?? null,
    });

    const updated = await this.prisma.patrolSession.update({
      where: { id: patrol.id },
      data: {
        lastLatitude: decimalOrNull(dto.latitude),
        lastLongitude: decimalOrNull(dto.longitude),
        lastLocationAt: new Date(),
        routeRecording: route.slice(-500),
      },
    });

    await this.prisma.officerStatus.updateMany({
      where: { officerId: ctx.officerId },
      data: {
        latitude: decimalOrNull(dto.latitude),
        longitude: decimalOrNull(dto.longitude),
        locationAt: new Date(),
        locationAccuracyMeters: dto.accuracyMeters ?? null,
        lastHeartbeatAt: new Date(),
      },
    });

    return { data: this.mapPatrol(updated) };
  }

  private async requireActiveShift(officerId: string) {
    const shift = await this.prisma.fieldShift.findFirst({
      where: { officerId, status: FieldShiftStatus.Active },
    });
    if (!shift) throw new BadRequestException("Active shift required before patrol");
    return shift;
  }

  private async requireActivePatrol(officerId: string) {
    const patrol = await this.prisma.patrolSession.findFirst({
      where: { officerId, status: { in: [PatrolSessionStatus.Active, PatrolSessionStatus.Paused] } },
    });
    if (!patrol) throw new BadRequestException("No active patrol session");
    return patrol;
  }

  mapPatrol(patrol: any) {
    return {
      id: patrol.id,
      fieldShiftId: patrol.fieldShiftId,
      status: patrol.status,
      patrolZoneLabel: patrol.patrolZoneLabel,
      startedAt: patrol.startedAt?.toISOString?.() ?? patrol.startedAt,
      pausedAt: patrol.pausedAt?.toISOString?.() ?? patrol.pausedAt ?? null,
      endedAt: patrol.endedAt?.toISOString?.() ?? patrol.endedAt ?? null,
      lastLatitude: patrol.lastLatitude != null ? Number(patrol.lastLatitude) : null,
      lastLongitude: patrol.lastLongitude != null ? Number(patrol.lastLongitude) : null,
      lastLocationAt: patrol.lastLocationAt?.toISOString?.() ?? patrol.lastLocationAt ?? null,
      routePointCount: Array.isArray(patrol.routeRecording) ? patrol.routeRecording.length : 0,
      metadata: patrol.metadata ?? {},
    };
  }
}
