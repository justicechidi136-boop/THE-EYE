import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { FIELD_SYNC_ERROR_CODES, FIELD_SYNC_MAX_BATCH_SIZE, FieldPatrolEventType } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { assertFieldSession, decimalOrNull } from "./field-session.util";

@Injectable()
export class FieldPatrolHardeningService {
  constructor(private readonly prisma: PrismaService) {}

  async recordEvent(
    actor: JwtPayload,
    dto: {
      eventType: FieldPatrolEventType;
      latitude?: number;
      longitude?: number;
      accuracyMeters?: number;
      note?: string;
      clientActionId?: string;
    },
  ) {
    const ctx = assertFieldSession(actor);
    const patrol = await this.prisma.patrolSession.findFirst({
      where: { officerId: ctx.officerId, status: { in: ["Active", "Paused"] } },
    });
    if (!patrol) throw new BadRequestException("Active patrol required");

    if (dto.clientActionId) {
      const dup = await this.prisma.fieldPatrolEvent.findUnique({ where: { clientActionId: dto.clientActionId } });
      if (dup) return { data: dup };
    }

    const event = await this.prisma.fieldPatrolEvent.create({
      data: {
        patrolSessionId: patrol.id,
        officerId: ctx.officerId,
        eventType: dto.eventType,
        latitude: decimalOrNull(dto.latitude),
        longitude: decimalOrNull(dto.longitude),
        accuracyMeters: dto.accuracyMeters ?? null,
        note: dto.note?.trim() || null,
        clientActionId: dto.clientActionId ?? null,
        metadata: {},
      },
    });

    const route = Array.isArray(patrol.routeRecording) ? [...patrol.routeRecording] : [];
    if (dto.latitude != null && dto.longitude != null) {
      route.push({
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyMeters: dto.accuracyMeters ?? null,
        recordedAt: new Date().toISOString(),
        eventType: dto.eventType,
      });
      await this.prisma.patrolSession.update({
        where: { id: patrol.id },
        data: { routeRecording: route.slice(-500), lastLatitude: decimalOrNull(dto.latitude), lastLongitude: decimalOrNull(dto.longitude), lastLocationAt: new Date() },
      });
    }

    return { data: event };
  }

  async getRouteHistory(actor: JwtPayload, patrolSessionId: string) {
    const ctx = assertFieldSession(actor);
    const patrol = await this.prisma.patrolSession.findFirst({
      where: { id: patrolSessionId, officerId: ctx.officerId },
      include: { patrolEvents: { orderBy: { occurredAt: "asc" }, take: 500 } },
    });
    if (!patrol) throw new BadRequestException("Patrol session not found");
    return {
      data: {
        sessionId: patrol.id,
        routePointCount: Array.isArray(patrol.routeRecording) ? patrol.routeRecording.length : 0,
        routeRecording: patrol.routeRecording,
        events: patrol.patrolEvents,
        startedAt: patrol.startedAt,
        endedAt: patrol.endedAt,
      },
    };
  }
}
