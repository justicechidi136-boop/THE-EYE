import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { AdminRoleName } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import {
  buildCursorPage,
  decodeSequenceCursor,
  encodeSequenceCursor,
  resolvePageLimit,
  sequenceCursorWhere,
  type CursorPageQuery,
} from "../../common/pagination/cursor-pagination";
import { PrismaService } from "../prisma/prisma.service";

export type AuditEventInput = {
  actor?: JwtPayload;
  actorType?: string;
  actorUserId?: string;
  actorAdminId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  reason?: string;
  beforeState?: unknown;
  afterState?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(input: AuditEventInput) {
    const previous = await this.prisma.auditLog.findFirst({ orderBy: { sequence: "desc" as never } });
    const sequence = await this.nextSequence(previous?.sequence ? BigInt(previous.sequence) + 1n : 1n);
    const createdAt = new Date();
    const payload = {
      sequence: sequence.toString(),
      previousHash: previous?.eventHash ?? null,
      actorUserId: input.actorUserId ?? (input.actor?.typ === "user" ? input.actor.sub : null),
      actorAdminId: input.actorAdminId ?? (input.actor?.typ === "admin" ? input.actor.sub : null),
      actorType: input.actorType ?? input.actor?.typ ?? "system",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      reason: input.reason ?? null,
      beforeState: input.beforeState ?? null,
      afterState: input.afterState ?? null,
      metadata: input.metadata ?? {},
      createdAt: createdAt.toISOString(),
      chainVersion: 1,
    };
    const eventHash = this.hashPayload(payload);

    return this.prisma.auditLog.create({
      data: {
        sequence,
        actorUserId: payload.actorUserId ?? undefined,
        actorAdminId: payload.actorAdminId ?? undefined,
        actorType: payload.actorType,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        reason: input.reason,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        beforeState: input.beforeState === undefined ? undefined : (input.beforeState as never),
        afterState: input.afterState === undefined ? undefined : (input.afterState as never),
        metadata: input.metadata ?? {},
        previousHash: payload.previousHash ?? undefined,
        eventHash,
        chainVersion: 1,
        createdAt,
      } as never,
    });
  }

  async list(actor: JwtPayload, filters: { action?: string; entityType?: string; entityId?: string } = {}, query: CursorPageQuery = {}) {
    const limit = resolvePageLimit(query.limit);
    const cursor = decodeSequenceCursor(query.cursor);
    const scope = actor.role === AdminRoleName.SuperAdmin || actor.role === AdminRoleName.OversightAuditor ? {} : { actorAdminId: actor.sub };
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...scope,
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.entityId ? { entityId: filters.entityId } : {}),
        ...sequenceCursorWhere(cursor),
      } as never,
      orderBy: [{ sequence: "desc" as never }, { id: "desc" }],
      take: limit + 1,
    });
    return buildCursorPage(rows, limit, (item) => encodeSequenceCursor(item.sequence));
  }

  async verifyChain() {
    const logs = await this.prisma.auditLog.findMany({ orderBy: { sequence: "asc" as never }, take: 10000 });
    let previousHash: string | null = null;
    const broken: Array<{ id: string; sequence: string; reason: string }> = [];

    for (const log of logs as any[]) {
      if (!log.eventHash) {
        broken.push({ id: log.id, sequence: String(log.sequence), reason: "missing_event_hash" });
        previousHash = log.eventHash ?? previousHash;
        continue;
      }
      if ((log.previousHash ?? null) !== previousHash) {
        broken.push({ id: log.id, sequence: String(log.sequence), reason: "previous_hash_mismatch" });
      }
      previousHash = log.eventHash;
    }

    return { verified: broken.length === 0, checked: logs.length, broken };
  }

  private hashPayload(payload: Record<string, unknown>) {
    return createHash("sha256").update(this.stableStringify(payload)).digest("hex");
  }

  private async nextSequence(fallback: bigint) {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ nextval: bigint }>>`SELECT nextval('audit_logs_sequence_seq')::bigint`;
      return BigInt(rows[0]?.nextval ?? fallback);
    } catch {
      return fallback;
    }
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((item) => this.stableStringify(item)).join(",")}]`;
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${this.stableStringify(object[key])}`).join(",")}}`;
  }
}
