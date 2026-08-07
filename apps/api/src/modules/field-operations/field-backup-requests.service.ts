import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  FieldBackupRequestStatus,
  FieldBackupRequestType,
  FieldOperationalEventType,
  IncidentPriority,
} from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { FieldEventsService } from "./field-events.service";
import { assertFieldSession, decimalOrNull } from "./field-session.util";

export type CreateFieldBackupDto = {
  requestType: FieldBackupRequestType;
  reason?: string;
  incidentId?: string;
  assignmentId?: string;
  latitude?: number;
  longitude?: number;
  priority?: IncidentPriority;
  clientActionId?: string;
  generationId?: string;
};

@Injectable()
export class FieldBackupRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: FieldEventsService,
  ) {}

  async create(actor: JwtPayload, dto: CreateFieldBackupDto) {
    const ctx = assertFieldSession(actor);
    if (!ctx.agencyId) throw new ForbiddenException("Agency required");
    if (!dto.requestType) throw new BadRequestException("requestType is required");

    if (dto.clientActionId) {
      const dup = await this.prisma.fieldBackupRequest.findUnique({ where: { clientActionId: dto.clientActionId } });
      if (dup) return { data: this.mapBackup(dup) };
    }

    const shift = await this.prisma.fieldShift.findFirst({
      where: { officerId: ctx.officerId, status: "Active" },
    });

    const backup = await this.prisma.fieldBackupRequest.create({
      data: {
        officerId: ctx.officerId,
        fieldDeviceId: ctx.fieldDeviceId,
        agencyId: ctx.agencyId,
        fieldShiftId: shift?.id ?? null,
        incidentId: dto.incidentId ?? null,
        assignmentId: dto.assignmentId ?? null,
        requestType: dto.requestType,
        status: FieldBackupRequestStatus.Requested,
        priority: dto.priority ?? IncidentPriority.P3Elevated,
        reason: dto.reason?.trim() || null,
        latitude: decimalOrNull(dto.latitude),
        longitude: decimalOrNull(dto.longitude),
        generationId: dto.generationId ?? null,
        clientActionId: dto.clientActionId ?? null,
      },
    });

    await this.events.publish({
      agencyId: ctx.agencyId,
      officerId: ctx.officerId,
      fieldDeviceId: ctx.fieldDeviceId,
      eventType: FieldOperationalEventType.BackupRequested,
      entityType: "field_backup_requests",
      entityId: backup.id,
      generationId: dto.generationId,
      payload: { requestType: backup.requestType, status: backup.status },
    });

    await this.audit.record({
      actor,
      action: "field.backup.requested",
      entityType: "field_backup_requests",
      entityId: backup.id,
      metadata: { requestType: backup.requestType },
    });

    return { data: this.mapBackup(backup) };
  }

  async listMine(actor: JwtPayload) {
    const ctx = assertFieldSession(actor);
    const rows = await this.prisma.fieldBackupRequest.findMany({
      where: { officerId: ctx.officerId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { data: rows.map((row) => this.mapBackup(row)) };
  }

  async listAgency(actor: JwtPayload, query: { status?: string; limit?: string }) {
    if (actor.typ !== "admin") throw new ForbiddenException("Supervisor access required");
    const rows = await this.prisma.fieldBackupRequest.findMany({
      where: {
        ...(actor.agencyId ? { agencyId: actor.agencyId } : {}),
        ...(query.status ? { status: query.status as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(query.limit) || 50, 200),
    });
    return { data: rows.map((row) => this.mapBackup(row)) };
  }

  async updateStatus(id: string, actor: JwtPayload, status: FieldBackupRequestStatus) {
    if (actor.typ !== "admin") throw new ForbiddenException("Supervisor access required");
    const backup = await this.prisma.fieldBackupRequest.findUnique({ where: { id } });
    if (!backup) throw new NotFoundException("Backup request not found");
    if (actor.agencyId && actor.agencyId !== backup.agencyId) throw new ForbiddenException("Out of scope");

    const patch: Record<string, unknown> = { status };
    const now = new Date();
    if (status === FieldBackupRequestStatus.Acknowledged) patch.acknowledgedAt = now;
    if (status === FieldBackupRequestStatus.Assigned) patch.assignedAt = now;
    if (status === FieldBackupRequestStatus.EnRoute) patch.enRouteAt = now;
    if (status === FieldBackupRequestStatus.Arrived) patch.arrivedAt = now;
    if (status === FieldBackupRequestStatus.Resolved) patch.resolvedAt = now;
    if (status === FieldBackupRequestStatus.Cancelled) patch.cancelledAt = now;

    const updated = await this.prisma.fieldBackupRequest.update({ where: { id }, data: patch });

    await this.events.publish({
      agencyId: backup.agencyId,
      officerId: backup.officerId,
      fieldDeviceId: backup.fieldDeviceId,
      eventType: FieldOperationalEventType.BackupAssigned,
      entityType: "field_backup_requests",
      entityId: updated.id,
      payload: { status: updated.status },
    });

    return { data: this.mapBackup(updated) };
  }

  mapBackup(row: any) {
    return {
      id: row.id,
      requestType: row.requestType,
      status: row.status,
      priority: row.priority,
      reason: row.reason,
      incidentId: row.incidentId,
      assignmentId: row.assignmentId,
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
      assignedUnitIds: row.assignedUnitIds ?? [],
      createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
      updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
    };
  }
}
