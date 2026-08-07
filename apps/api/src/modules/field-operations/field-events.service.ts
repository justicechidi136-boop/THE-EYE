import { Injectable } from "@nestjs/common";
import { FieldOperationalEventType } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { assertFieldSession } from "./field-session.util";

@Injectable()
export class FieldEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async publish(input: {
    agencyId: string;
    officerId: string;
    fieldDeviceId?: string;
    eventType: FieldOperationalEventType;
    entityType?: string;
    entityId?: string;
    generationId?: string;
    payload?: Record<string, unknown>;
  }) {
    const last = await this.prisma.fieldOperationalEvent.findFirst({
      where: { officerId: input.officerId },
      orderBy: { eventSequence: "desc" },
      select: { eventSequence: true },
    });
    const eventSequence = (last?.eventSequence ?? BigInt(0)) + BigInt(1);
    const event = await this.prisma.fieldOperationalEvent.create({
      data: {
        agencyId: input.agencyId,
        officerId: input.officerId,
        fieldDeviceId: input.fieldDeviceId ?? null,
        eventSequence,
        eventType: input.eventType,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        generationId: input.generationId ?? null,
        payload: input.payload ?? {},
        occurredAt: new Date(),
      },
    });
    if (input.fieldDeviceId) {
      await this.prisma.fieldDeviceSyncState.upsert({
        where: { fieldDeviceId: input.fieldDeviceId },
        create: {
          fieldDeviceId: input.fieldDeviceId,
          officerId: input.officerId,
          generationId: input.generationId ?? "default",
          lastEventSequence: eventSequence,
        },
        update: { lastEventSequence: eventSequence },
      });
    }
    return event;
  }

  async poll(actor: JwtPayload, query: { afterSequence?: string; generationId?: string; limit?: string }) {
    const ctx = assertFieldSession(actor);
    const after = query.afterSequence ? BigInt(query.afterSequence) : BigInt(0);
    const limit = Math.min(Number(query.limit) || 50, 100);
    const rows = await this.prisma.fieldOperationalEvent.findMany({
      where: {
        officerId: ctx.officerId,
        eventSequence: { gt: after },
        ...(query.generationId ? { OR: [{ generationId: null }, { generationId: query.generationId }] } : {}),
      },
      orderBy: { eventSequence: "asc" },
      take: limit,
    });
    const syncState = ctx.fieldDeviceId
      ? await this.prisma.fieldDeviceSyncState.findUnique({ where: { fieldDeviceId: ctx.fieldDeviceId } })
      : null;
    return {
      data: {
        events: rows.map((row) => ({
          id: row.id,
          eventSequence: row.eventSequence.toString(),
          eventType: row.eventType,
          entityType: row.entityType,
          entityId: row.entityId,
          generationId: row.generationId,
          payload: row.payload,
          occurredAt: row.occurredAt.toISOString(),
        })),
        lastSequence: rows.length ? rows[rows.length - 1]!.eventSequence.toString() : after.toString(),
        generationId: syncState?.generationId ?? query.generationId ?? null,
        pollIntervalSeconds: 15,
      },
    };
  }
}
