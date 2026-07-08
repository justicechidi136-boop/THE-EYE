import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AdminRoleName, IncidentStatus } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEscalationRuleDto, RunEscalationCheckDto, UpdateEscalationRuleDto } from "./dto/escalation-rule.dto";

type EscalationRuleLike = {
  id: string;
  name: string;
  incidentType?: string | null;
  priority?: string | null;
  jurisdictionId?: string | null;
  agencyId?: string | null;
  maxResponseTimeSeconds: number;
  escalationDestinationRole?: string | null;
  escalationDestinationAdminId?: string | null;
  escalationDestinationAgencyId?: string | null;
};

type IncidentLike = {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  jurisdictionId: string;
  assignedAgencyId?: string | null;
  assignedAdminId?: string | null;
  country: string;
  state: string;
  lga: string;
  createdAt: Date;
  statusHistory: Array<{ toStatus: string; createdAt: Date }>;
};

@Injectable()
export class EscalationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createRule(dto: CreateEscalationRuleDto, actor?: JwtPayload) {
    this.validateRule(dto);
    const rule = await this.prisma.escalationRule.create({
      data: {
        name: dto.name,
        incidentType: dto.incidentType as never,
        priority: dto.priority as never,
        jurisdictionId: dto.jurisdictionId,
        agencyId: dto.agencyId,
        maxResponseTimeSeconds: dto.maxResponseTimeSeconds,
        escalationDestinationRole: dto.escalationDestinationRole,
        escalationDestinationAdminId: dto.escalationDestinationAdminId,
        escalationDestinationAgencyId: dto.escalationDestinationAgencyId,
        createdByAdminId: actor?.typ === "admin" ? actor.sub : undefined,
      } as never,
    });

    await this.writeAudit("create", "escalation_rules", rule.id, actor, undefined, rule, { reason: "Escalation rule created" });
    return rule;
  }

  listRules() {
    return this.prisma.escalationRule.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] });
  }

  async updateRule(id: string, dto: UpdateEscalationRuleDto, actor?: JwtPayload) {
    const existing = await this.prisma.escalationRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Escalation rule not found");
    if (dto.maxResponseTimeSeconds !== undefined && dto.maxResponseTimeSeconds <= 0) throw new BadRequestException("maxResponseTimeSeconds must be greater than 0");

    const updated = await this.prisma.escalationRule.update({
      where: { id },
      data: {
        name: dto.name,
        incidentType: dto.incidentType as never,
        priority: dto.priority as never,
        jurisdictionId: dto.jurisdictionId,
        agencyId: dto.agencyId,
        maxResponseTimeSeconds: dto.maxResponseTimeSeconds,
        escalationDestinationRole: dto.escalationDestinationRole,
        escalationDestinationAdminId: dto.escalationDestinationAdminId,
        escalationDestinationAgencyId: dto.escalationDestinationAgencyId,
        isActive: dto.isActive,
      } as never,
    });

    await this.writeAudit("update", "escalation_rules", id, actor, existing, updated, { reason: "Escalation rule updated" });
    return updated;
  }

  async runEscalationCheck(dto: RunEscalationCheckDto = {}, actor?: JwtPayload) {
    const rules = await this.prisma.escalationRule.findMany({ where: { isActive: true } }) as EscalationRuleLike[];
    const results: Array<{ incidentId: string; ruleId: string; escalated: boolean; reason: string }> = [];

    for (const rule of rules) {
      const incidents = await this.findOverdueIncidentsForRule(rule);
      for (const incident of incidents) {
        const reason = this.escalationReason(incident, rule);
        if (dto.dryRun) {
          results.push({ incidentId: incident.id, ruleId: rule.id, escalated: false, reason });
          continue;
        }

        await this.escalateIncident(incident, rule, reason, actor);
        results.push({ incidentId: incident.id, ruleId: rule.id, escalated: true, reason });
      }
    }

    return { checkedRules: rules.length, escalations: results };
  }

  async acknowledgeEscalation(id: string, actor?: JwtPayload) {
    const existing = await this.prisma.incidentEscalation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Escalation not found");

    const updated = await this.prisma.incidentEscalation.update({
      where: { id },
      data: { status: "Acknowledged" as never, acknowledgedAt: new Date() },
    });

    await this.prisma.incidentTimeline.create({
      data: {
        incidentId: existing.incidentId,
        actorId: actor?.typ === "user" ? actor.sub : undefined,
        actorType: actor?.typ ?? "system",
        eventType: "incident.escalation_acknowledged",
        message: "Escalation acknowledged.",
        metadata: { escalationId: id },
      },
    });

    await this.writeAudit("update", "incident_escalations", id, actor, existing, updated, { reason: "Escalation acknowledged" });
    return updated;
  }

  private async findOverdueIncidentsForRule(rule: EscalationRuleLike) {
    const incidents = await this.prisma.incident.findMany({
      where: {
        status: IncidentStatus.Assigned as never,
        ...(rule.incidentType ? { type: rule.incidentType as never } : {}),
        ...(rule.priority ? { priority: rule.priority as never } : {}),
        ...(rule.jurisdictionId ? { jurisdictionId: rule.jurisdictionId } : {}),
        ...(rule.agencyId ? { assignedAgencyId: rule.agencyId } : {}),
      } as never,
      include: { statusHistory: { orderBy: { createdAt: "desc" }, take: 10 } },
      take: 100,
    }) as IncidentLike[];

    const now = Date.now();
    const overdue: IncidentLike[] = [];
    for (const incident of incidents) {
      const assignedAt = incident.statusHistory.find((event) => event.toStatus === IncidentStatus.Assigned)?.createdAt ?? incident.createdAt;
      const alreadyEscalated = await this.prisma.incidentEscalation.count({
        where: { incidentId: incident.id, ruleId: rule.id, status: { in: ["Pending", "Notified"] as never } } as never,
      });
      if (!alreadyEscalated && now - assignedAt.getTime() >= rule.maxResponseTimeSeconds * 1000) overdue.push(incident);
    }
    return overdue;
  }

  private async escalateIncident(incident: IncidentLike, rule: EscalationRuleLike, reason: string, actor?: JwtPayload) {
    const destination = await this.resolveDestination(rule, incident);

    const escalation = await this.prisma.incidentEscalation.create({
      data: {
        incidentId: incident.id,
        ruleId: rule.id,
        toAdminId: destination.toAdminId,
        toAgencyId: destination.toAgencyId,
        destinationRole: destination.destinationRole,
        status: "Notified" as never,
        reason,
        metadata: { ruleName: rule.name, maxResponseTimeSeconds: rule.maxResponseTimeSeconds },
      } as never,
    });

    await this.prisma.incidentTimeline.create({
      data: {
        incidentId: incident.id,
        actorId: actor?.typ === "user" ? actor.sub : undefined,
        actorType: actor?.typ ?? "system",
        eventType: "incident.escalated",
        message: reason,
        metadata: { escalationId: escalation.id, ruleId: rule.id, destination },
      },
    });

    await this.notifyAgency(incident, rule, escalation.id);
    await this.notifySuperAdmins(incident, escalation.id);
    await this.notifyDestinationAdmins(incident, destination, escalation.id);
    await this.writeAudit("escalation.triggered", "incident_escalations", escalation.id, actor, undefined, escalation, { reason, incidentId: incident.id, ruleId: rule.id });

    return escalation;
  }

  private async resolveDestination(rule: EscalationRuleLike, incident: IncidentLike) {
    if (rule.escalationDestinationAdminId) return { toAdminId: rule.escalationDestinationAdminId, toAgencyId: rule.escalationDestinationAgencyId ?? undefined, destinationRole: rule.escalationDestinationRole ?? undefined };
    if (rule.escalationDestinationAgencyId) return { toAgencyId: rule.escalationDestinationAgencyId, destinationRole: rule.escalationDestinationRole ?? undefined };
    return { toAgencyId: incident.assignedAgencyId ?? rule.agencyId ?? undefined, destinationRole: rule.escalationDestinationRole ?? AdminRoleName.SuperAdmin };
  }

  private async notifyAgency(incident: IncidentLike, rule: EscalationRuleLike, escalationId: string) {
    const agencyId = rule.escalationDestinationAgencyId ?? incident.assignedAgencyId ?? rule.agencyId;
    if (!agencyId) return;

    const admins = await this.prisma.adminUser.findMany({ where: { agencyId, isActive: true }, select: { id: true } });
    await this.createAdminNotifications(admins.map((admin) => admin.id), incident, escalationId, "Agency escalation", "Incident requires agency response acknowledgement.");
  }

  private async notifySuperAdmins(incident: IncidentLike, escalationId: string) {
    const superAdmins = await this.prisma.adminUser.findMany({ where: { role: { name: AdminRoleName.SuperAdmin }, isActive: true }, select: { id: true } });
    await this.createAdminNotifications(superAdmins.map((admin) => admin.id), incident, escalationId, "High priority escalation", "High priority incident was escalated due to missing acknowledgement.");
  }

  private async notifyDestinationAdmins(incident: IncidentLike, destination: { toAdminId?: string; destinationRole?: string }, escalationId: string) {
    if (destination.toAdminId) {
      await this.createAdminNotifications([destination.toAdminId], incident, escalationId, "Incident escalation", "Incident was escalated to you.");
      return;
    }

    if (!destination.destinationRole) return;
    const admins = await this.prisma.adminUser.findMany({ where: { role: { name: destination.destinationRole }, isActive: true }, select: { id: true } });
    await this.createAdminNotifications(admins.map((admin) => admin.id), incident, escalationId, "Incident escalation", `Incident was escalated to ${destination.destinationRole}.`);
  }

  private async createAdminNotifications(adminIds: string[], incident: IncidentLike, escalationId: string, title: string, body: string) {
    const uniqueIds = [...new Set(adminIds)].filter(Boolean);
    for (const adminId of uniqueIds) {
      await this.prisma.$executeRaw`
        INSERT INTO notifications (admin_user_id, incident_id, channel, title, body, status, provider)
        VALUES (${adminId}::uuid, ${incident.id}::uuid, 'in_app', ${title}, ${body || incident.title}, 'Pending', 'the-eye-escalation')
      `;
    }
  }

  private async writeAudit(action: string, entityType: string, entityId: string, actor: JwtPayload | undefined, beforeState: unknown, afterState: unknown, metadata: Record<string, unknown>) {
    await this.audit.record({
      actor,
      action,
      entityType,
      entityId,
      reason: typeof metadata.reason === "string" ? metadata.reason : undefined,
      beforeState,
      afterState,
      metadata,
    });
  }

  private validateRule(dto: CreateEscalationRuleDto) {
    if (!dto.name) throw new BadRequestException("Rule name is required");
    if (!dto.maxResponseTimeSeconds || dto.maxResponseTimeSeconds <= 0) throw new BadRequestException("maxResponseTimeSeconds must be greater than 0");
    if (!dto.escalationDestinationRole && !dto.escalationDestinationAdminId && !dto.escalationDestinationAgencyId) throw new BadRequestException("At least one escalation destination is required");
  }

  private escalationReason(incident: IncidentLike, rule: EscalationRuleLike) {
    return `Incident ${incident.id} was assigned but not acknowledged within ${rule.maxResponseTimeSeconds} seconds.`;
  }
}

