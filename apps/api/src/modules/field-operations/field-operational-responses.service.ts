import { Injectable, NotFoundException } from "@nestjs/common";
import { OfficerOperationalStatus, OperationalResponseType } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { DispatchService } from "../dispatch/dispatch.service";
import { PrismaService } from "../prisma/prisma.service";
import type { OperationalResponseDto } from "./dto/field-workflows.dto";
import { validateOperationalResponseDto } from "./dto/field-workflows.dto";
import { assertFieldSession, decimalOrNull } from "./field-session.util";

@Injectable()
export class FieldOperationalResponsesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly dispatch: DispatchService,
  ) {}

  async recordResponse(actor: JwtPayload, dto: OperationalResponseDto) {
    validateOperationalResponseDto(dto);
    const ctx = assertFieldSession(actor);

    if (dto.clientActionId) {
      const duplicate = await this.prisma.operationalResponse.findUnique({ where: { clientActionId: dto.clientActionId } });
      if (duplicate) return { data: this.mapResponse(duplicate) };
    }

    const [shift, patrol, checkpoint] = await Promise.all([
      this.prisma.fieldShift.findFirst({
        where: { officerId: ctx.officerId, status: { in: ["Active", "Paused"] } },
      }),
      this.prisma.patrolSession.findFirst({
        where: { officerId: ctx.officerId, status: { in: ["Active", "Paused"] } },
      }),
      this.prisma.checkpointSession.findFirst({
        where: { officerId: ctx.officerId, status: { in: ["Active", "Paused"] } },
      }),
    ]);

    const response = await this.prisma.operationalResponse.create({
      data: {
        officerId: ctx.officerId,
        fieldDeviceId: ctx.fieldDeviceId,
        fieldShiftId: shift?.id ?? null,
        patrolSessionId: patrol?.id ?? null,
        checkpointSessionId: checkpoint?.id ?? null,
        incidentId: dto.incidentId ?? null,
        assignmentId: dto.assignmentId ?? null,
        responseType: dto.responseType,
        note: dto.note?.trim() || null,
        latitude: decimalOrNull(dto.latitude),
        longitude: decimalOrNull(dto.longitude),
        clientActionId: dto.clientActionId ?? null,
        syncedAt: new Date(),
      },
    });

    if (dto.assignmentId) {
      await this.applyAssignmentSideEffects(actor, dto);
    }

    if (dto.incidentId || dto.assignmentId) {
      await this.prisma.officerStatus.updateMany({
        where: { officerId: ctx.officerId },
        data: {
          status:
            dto.responseType === OperationalResponseType.Resolved
              ? OfficerOperationalStatus.OnShift
              : OfficerOperationalStatus.Responding,
        },
      });
    }

    await this.audit.record({
      actor,
      action: "field.operational_response.recorded",
      entityType: "operational_responses",
      entityId: response.id,
      metadata: { responseType: dto.responseType, incidentId: dto.incidentId, assignmentId: dto.assignmentId },
    });

    return { data: this.mapResponse(response) };
  }

  async listForAssignment(actor: JwtPayload, assignmentId: string) {
    const ctx = assertFieldSession(actor);
    const rows = await this.prisma.operationalResponse.findMany({
      where: { assignmentId, officerId: ctx.officerId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { data: rows.map((row) => this.mapResponse(row)) };
  }

  private async applyAssignmentSideEffects(actor: JwtPayload, dto: OperationalResponseDto) {
    if (!dto.assignmentId) return;
    const assignment = await (this.prisma as any).incidentAssignment.findUnique({ where: { id: dto.assignmentId } });
    if (!assignment) throw new NotFoundException("Assignment not found");

    const actionMap: Partial<Record<OperationalResponseType, "arrive" | "in_progress" | "complete">> = {
      [OperationalResponseType.Arrived]: "arrive",
      [OperationalResponseType.UnderControl]: "in_progress",
      [OperationalResponseType.Resolved]: "complete",
    };

    const action = actionMap[dto.responseType];
    if (action) {
      await this.dispatch.updateAssignment(
        dto.assignmentId,
        { action, version: assignment.version, note: dto.note },
        actor,
      );
    }

    if (dto.responseType === OperationalResponseType.NeedMoreUnits || dto.responseType === OperationalResponseType.BackupRequested) {
      await this.dispatch.requestAssignmentBackup(dto.assignmentId, dto.note ?? "Backup requested from field tablet", actor);
    }
  }

  mapResponse(row: any) {
    return {
      id: row.id,
      responseType: row.responseType,
      incidentId: row.incidentId,
      assignmentId: row.assignmentId,
      note: row.note,
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
      createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    };
  }
}
