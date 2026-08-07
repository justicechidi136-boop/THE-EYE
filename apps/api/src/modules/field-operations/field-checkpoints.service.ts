import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { CheckpointSessionStatus, FieldShiftStatus, OfficerOperationalStatus } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { CheckpointQueueDto, StartCheckpointSessionDto } from "./dto/field-workflows.dto";
import { validateStartCheckpointDto } from "./dto/field-workflows.dto";
import { assertFieldSession, decimalOrNull } from "./field-session.util";

@Injectable()
export class FieldCheckpointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getActiveCheckpoint(actor: JwtPayload) {
    const ctx = assertFieldSession(actor);
    const session = await this.prisma.checkpointSession.findFirst({
      where: { officerId: ctx.officerId, status: { in: [CheckpointSessionStatus.Active, CheckpointSessionStatus.Paused] } },
      orderBy: { startedAt: "desc" },
    });
    return { data: session ? this.mapCheckpoint(session) : null };
  }

  async startCheckpoint(actor: JwtPayload, dto: StartCheckpointSessionDto) {
    validateStartCheckpointDto(dto);
    const ctx = assertFieldSession(actor);
    const shift = await this.requireActiveShift(ctx.officerId);

    const activePatrol = await this.prisma.patrolSession.findFirst({
      where: { officerId: ctx.officerId, status: { in: ["Active", "Paused"] } },
    });
    if (activePatrol) throw new ConflictException("End patrol session before starting checkpoint");

    const existing = await this.prisma.checkpointSession.findFirst({
      where: { officerId: ctx.officerId, status: { in: [CheckpointSessionStatus.Active, CheckpointSessionStatus.Paused] } },
    });
    if (existing) throw new ConflictException("Checkpoint session already active");

    if (dto.clientActionId) {
      const duplicate = await this.prisma.checkpointSession.findUnique({ where: { clientActionId: dto.clientActionId } });
      if (duplicate) return { data: this.mapCheckpoint(duplicate) };
    }

    const session = await this.prisma.checkpointSession.create({
      data: {
        fieldShiftId: shift.id,
        officerId: ctx.officerId,
        fieldDeviceId: ctx.fieldDeviceId,
        agencyId: shift.agencyId,
        checkpointName: dto.checkpointName.trim(),
        checkpointZoneLabel: dto.checkpointZoneLabel?.trim() || null,
        status: CheckpointSessionStatus.Active,
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
        checkpointSessionId: session.id,
        status: OfficerOperationalStatus.AtCheckpoint,
        lastHeartbeatAt: new Date(),
      },
      update: {
        checkpointSessionId: session.id,
        patrolSessionId: null,
        status: OfficerOperationalStatus.AtCheckpoint,
        lastHeartbeatAt: new Date(),
      },
    });

    await this.audit.record({
      actor,
      action: "field.checkpoint.started",
      entityType: "checkpoint_sessions",
      entityId: session.id,
      metadata: { checkpointName: session.checkpointName },
    });

    return { data: this.mapCheckpoint(session) };
  }

  async pauseCheckpoint(actor: JwtPayload) {
    const ctx = assertFieldSession(actor);
    const session = await this.requireActiveCheckpoint(ctx.officerId);
    const updated = await this.prisma.checkpointSession.update({
      where: { id: session.id },
      data: { status: CheckpointSessionStatus.Paused, pausedAt: new Date() },
    });
    return { data: this.mapCheckpoint(updated) };
  }

  async resumeCheckpoint(actor: JwtPayload) {
    const ctx = assertFieldSession(actor);
    const session = await this.requireActiveCheckpoint(ctx.officerId);
    if (session.status !== CheckpointSessionStatus.Paused) throw new BadRequestException("Checkpoint is not paused");
    const updated = await this.prisma.checkpointSession.update({
      where: { id: session.id },
      data: { status: CheckpointSessionStatus.Active, pausedAt: null },
    });
    return { data: this.mapCheckpoint(updated) };
  }

  async endCheckpoint(actor: JwtPayload) {
    const ctx = assertFieldSession(actor);
    const session = await this.requireActiveCheckpoint(ctx.officerId);
    const updated = await this.prisma.checkpointSession.update({
      where: { id: session.id },
      data: { status: CheckpointSessionStatus.Ended, endedAt: new Date() },
    });

    await this.prisma.officerStatus.updateMany({
      where: { officerId: ctx.officerId, checkpointSessionId: session.id },
      data: { checkpointSessionId: null, status: OfficerOperationalStatus.OnShift },
    });

    await this.audit.record({
      actor,
      action: "field.checkpoint.ended",
      entityType: "checkpoint_sessions",
      entityId: session.id,
    });

    return { data: this.mapCheckpoint(updated) };
  }

  async updateQueue(actor: JwtPayload, dto: CheckpointQueueDto) {
    const ctx = assertFieldSession(actor);
    const session = await this.requireActiveCheckpoint(ctx.officerId);
    const updated = await this.prisma.checkpointSession.update({
      where: { id: session.id },
      data: {
        queueCount: dto.queueCount ?? session.queueCount,
        vehicleChecks: dto.vehicleChecks ?? session.vehicleChecks,
      },
    });
    return { data: this.mapCheckpoint(updated) };
  }

  async search(actor: JwtPayload, query: { q?: string; type?: string; limit?: string }) {
    const ctx = assertFieldSession(actor);
    const q = query.q?.trim();
    const limit = Math.min(Number(query.limit) || 25, 100);
    const broadcasts = await this.prisma.broadcast.findMany({
      where: {
        status: "Published",
        ...(ctx.state ? { state: ctx.state } : {}),
        ...(ctx.lga ? { lga: ctx.lga } : {}),
        ...(query.type ? { type: query.type as never } : { type: { in: ["MissingPerson", "StolenVehicle"] as never[] } }),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { body: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        priority: true,
        publishedAt: true,
        metadata: true,
      },
    });

    return {
      data: {
        broadcasts: broadcasts.map((row) => ({
          id: row.id,
          type: row.type,
          title: row.title,
          summary: row.body.slice(0, 240),
          priority: row.priority,
          publishedAt: row.publishedAt?.toISOString?.() ?? null,
          metadata: row.metadata ?? {},
        })),
      },
    };
  }

  private async requireActiveShift(officerId: string) {
    const shift = await this.prisma.fieldShift.findFirst({
      where: { officerId, status: FieldShiftStatus.Active },
    });
    if (!shift) throw new BadRequestException("Active shift required before checkpoint");
    return shift;
  }

  private async requireActiveCheckpoint(officerId: string) {
    const session = await this.prisma.checkpointSession.findFirst({
      where: { officerId, status: { in: [CheckpointSessionStatus.Active, CheckpointSessionStatus.Paused] } },
    });
    if (!session) throw new BadRequestException("No active checkpoint session");
    return session;
  }

  mapCheckpoint(session: any) {
    return {
      id: session.id,
      fieldShiftId: session.fieldShiftId,
      checkpointName: session.checkpointName,
      checkpointZoneLabel: session.checkpointZoneLabel,
      status: session.status,
      queueCount: session.queueCount,
      vehicleChecks: session.vehicleChecks,
      startedAt: session.startedAt?.toISOString?.() ?? session.startedAt,
      pausedAt: session.pausedAt?.toISOString?.() ?? session.pausedAt ?? null,
      endedAt: session.endedAt?.toISOString?.() ?? session.endedAt ?? null,
      lastLatitude: session.lastLatitude != null ? Number(session.lastLatitude) : null,
      lastLongitude: session.lastLongitude != null ? Number(session.lastLongitude) : null,
      metadata: session.metadata ?? {},
    };
  }
}
