import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AdminRoleName,
  IncidentAssignmentStatus,
  IncidentPriority,
  IncidentStatus,
  ResponderAvailability,
} from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import {
  buildCursorPage,
  decodeDateIdCursor,
  encodeDateIdCursor,
  resolvePageLimit,
} from "../../common/pagination/cursor-pagination";
import { canTransitionIncident } from "../incidents/incident-lifecycle";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { AgencyRoutingService } from "./agency-routing.service";
import {
  ACTIVE_ASSIGNMENT_STATUSES,
  ASSIGNMENT_ACCEPT_TIMEOUT_SECONDS,
  canTransitionAssignment,
} from "./assignment-lifecycle";
import {
  AssignDispatchIncidentDto,
  DispatchIncidentQuery,
  EscalateDispatchIncidentDto,
  TriageOverrideDto,
  UpdateDispatchAssignmentDto,
  UpdateResponderAvailabilityDto,
  validateAssignDispatchIncidentDto,
  validateEscalateDispatchIncidentDto,
  validateTriageOverrideDto,
  validateUpdateDispatchAssignmentDto,
  validateUpdateResponderAvailabilityDto,
} from "./dto/dispatch.dto";
import { TriageService, type TriageResult } from "./triage.service";

const DISPATCH_QUEUE_STATUSES = [
  IncidentStatus.Submitted,
  IncidentStatus.Received,
  IncidentStatus.Verifying,
  IncidentStatus.Verified,
  IncidentStatus.Assigned,
  IncidentStatus.Responding,
];

@Injectable()
export class DispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly triageService: TriageService,
    private readonly agencyRouting: AgencyRoutingService,
  ) {}

  async listIncidents(actor: JwtPayload, query: DispatchIncidentQuery = {}) {
    this.assertDispatchReader(actor);
    const limit = resolvePageLimit(query.limit);
    const cursor = decodeDateIdCursor(query.cursor);
    const where: Record<string, unknown> = {
      ...this.dispatchScopeWhere(actor),
      status: { in: query.status ? [query.status] : DISPATCH_QUEUE_STATUSES },
    };
    if (query.priority?.trim()) where.priority = query.priority.trim();
    if (query.type?.trim()) where.type = query.type.trim();
    if (query.agencyId?.trim()) where.assignedAgencyId = query.agencyId.trim();
    if (query.jurisdictionId?.trim()) where.jurisdictionId = query.jurisdictionId.trim();
    if (query.unassignedOnly === "true") {
      where.status = IncidentStatus.Verified;
      where.assignedAgencyId = null;
    }

    const rows = await this.prisma.incident.findMany({
      where: {
        ...where,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      } as never,
      include: {
        assignedAgency: true,
        statusHistory: { orderBy: { createdAt: "desc" }, take: 3 },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      take: limit + 1,
    });

    return buildCursorPage(rows, limit, (item) => encodeDateIdCursor(item.createdAt, item.id));
  }

  async getIncident(id: string, actor: JwtPayload) {
    this.assertDispatchReader(actor);
    const incident = await this.prisma.incident.findFirst({
      where: { id, ...this.dispatchScopeWhere(actor) } as never,
      include: {
        assignedAgency: true,
        timeline: { orderBy: { createdAt: "asc" } },
        statusHistory: { orderBy: { createdAt: "asc" } },
        locationUpdates: { orderBy: { capturedAt: "desc" }, take: 5 },
      },
    });
    if (!incident) throw new NotFoundException("Incident not found or outside dispatch scope");

    const metadata = (incident.metadata ?? {}) as Record<string, unknown>;
    const triage = metadata.triage as TriageResult | undefined;
    const routing = triage
      ? await this.agencyRouting.recommend({
          jurisdictionId: incident.jurisdictionId,
          latitude: Number(incident.latitude),
          longitude: Number(incident.longitude),
          suggestedAgencyTypes: triage.suggestedAgencyTypes,
        })
      : { data: [], distanceSource: "haversine" as const };

    const assignments = await (this.prisma as any).incidentAssignment.findMany({
      where: { incidentId: id },
      include: { responder: true, responseUnit: true, agency: true },
      orderBy: { createdAt: "desc" },
    });

    return {
      data: {
        incident: this.sanitizeIncidentForActor(incident, actor),
        triage,
        routingRecommendations: routing.data,
        distanceSource: routing.distanceSource,
        assignments,
      },
    };
  }

  async runTriageForIncident(incidentId: string, actor?: JwtPayload, override?: TriageOverrideDto) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        media: true,
        reporter: { include: { trustedReporter: true } },
      },
    });
    if (!incident) throw new NotFoundException("Incident not found");

    if (override) {
      validateTriageOverrideDto(override);
      if (!actor || actor.typ !== "admin") throw new ForbiddenException("Dispatcher override requires admin access");
    }

    const metadata = (incident.metadata ?? {}) as Record<string, unknown>;
    const indicators = (metadata.activeThreat !== undefined ? metadata : metadata.indicators ?? metadata) as Record<string, unknown>;
    const duplicateReportCount = await this.countNearbyDuplicates(incident.id, Number(incident.latitude), Number(incident.longitude));

    const triage = this.triageService.evaluate({
      incidentId: incident.id,
      incidentType: incident.type,
      priority: incident.priority,
      latitude: Number(incident.latitude),
      longitude: Number(incident.longitude),
      isTrustedReporter: Boolean(incident.reporter?.isTrustedReporter),
      mediaCount: incident.media.length,
      duplicateReportCount,
      indicators: {
        activeThreat: Boolean(indicators.activeThreat),
        injuryIndicators: Array.isArray(indicators.injuryIndicators) ? (indicators.injuryIndicators as string[]) : undefined,
        weaponIndicators: Boolean(indicators.weaponIndicators),
        medicalIndicators: Boolean(indicators.medicalIndicators),
      },
      dispatcherOverride: override
        ? {
            priority: override.priority,
            responseUrgency: override.responseUrgency,
            suggestedAgencyTypes: override.suggestedAgencyTypes,
            escalationDeadlineSeconds: override.escalationDeadlineSeconds,
            overrideReason: override.overrideReason,
            actorId: actor?.sub,
          }
        : undefined,
    });

    const nextStatus =
      incident.status === IncidentStatus.Submitted ? IncidentStatus.Received : (incident.status as IncidentStatus);
    const updated = await this.prisma.incident.update({
      where: { id: incident.id },
      data: {
        priority: triage.priority as never,
        ...(incident.status === IncidentStatus.Submitted ? { status: nextStatus as never } : {}),
        metadata: {
          ...metadata,
          triage,
          triagedAt: new Date().toISOString(),
        },
        timeline: {
          create: {
            actorId: actor?.typ === "admin" ? actor.sub : undefined,
            actorType: actor?.typ ?? "system",
            eventType: "incident.triage",
            message: triage.overridden ? "Triage overridden by dispatcher." : "Automatic triage completed.",
            metadata: { triage },
          },
        },
        ...(incident.status === IncidentStatus.Submitted
          ? {
              statusHistory: {
                create: {
                  fromStatus: incident.status as never,
                  toStatus: nextStatus as never,
                  note: "Incident received after triage.",
                },
              },
            }
          : {}),
      } as never,
    });

    await (this.prisma as any).dispatchEvent.create({
      data: {
        incidentId: incident.id,
        actorAdminId: actor?.typ === "admin" ? actor.sub : undefined,
        eventType: triage.overridden ? "triage.overridden" : "triage.completed",
        message: triage.rationale.join(" "),
        metadata: { triage },
      },
    });

    await this.audit.record({
      actor,
      action: triage.overridden ? "incident.triage_overridden" : "incident.triage",
      entityType: "incidents",
      entityId: incident.id,
      afterState: { priority: triage.priority, status: updated.status },
      metadata: { triage },
      reason: override?.overrideReason,
    });

    return { data: triage, incident: updated };
  }

  async assignIncident(id: string, dto: AssignDispatchIncidentDto, actor: JwtPayload) {
    this.assertDispatcher(actor);
    validateAssignDispatchIncidentDto(dto);

    const clientAssignmentId = dto.clientAssignmentId?.trim();
    if (clientAssignmentId) {
      const existingByClient = await (this.prisma as any).incidentAssignment.findUnique({
        where: { clientAssignmentId },
      });
      if (existingByClient) return { data: existingByClient, duplicate: true };
    }

    const incident = await this.prisma.incident.findFirst({
      where: { id, ...this.dispatchScopeWhere(actor) } as never,
    });
    if (!incident) throw new NotFoundException("Incident not found or outside dispatch scope");

    const allowedStatuses = [IncidentStatus.Verified, IncidentStatus.Assigned, IncidentStatus.Responding];
    if (!allowedStatuses.includes(incident.status as IncidentStatus)) {
      throw new BadRequestException(`Incident in status ${incident.status} cannot be assigned`);
    }

    await this.assertAgencyInScope(dto.agencyId, actor, incident.jurisdictionId);

    if (dto.responderId) {
      await this.assertResponderAssignable(dto.responderId, dto.agencyId);
      const duplicateResponder = await (this.prisma as any).incidentAssignment.findFirst({
        where: {
          incidentId: id,
          responderId: dto.responderId,
          status: { in: ACTIVE_ASSIGNMENT_STATUSES },
        },
      });
      if (duplicateResponder) {
        throw new ConflictException("Responder already has an active assignment on this incident");
      }
    }

    const activeAssignment = await (this.prisma as any).incidentAssignment.findFirst({
      where: { incidentId: id, status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
    });
    if (activeAssignment) {
      throw new ConflictException("Incident already has an active assignment; reassign after decline/expiry");
    }

    const expiresAt = new Date(Date.now() + ASSIGNMENT_ACCEPT_TIMEOUT_SECONDS * 1000);
    const assignment = await (this.prisma as any).incidentAssignment.create({
      data: {
        incidentId: id,
        agencyId: dto.agencyId,
        responderId: dto.responderId,
        responseUnitId: dto.responseUnitId,
        assignedByAdminId: actor.sub,
        clientAssignmentId: clientAssignmentId || undefined,
        status: IncidentAssignmentStatus.Assigned,
        priority: (dto.priority ?? incident.priority) as never,
        expiresAt,
        metadata: {
          reason: dto.reason,
          overrideReason: dto.overrideReason,
          routingRecommendationRank: dto.routingRecommendationRank,
        },
      },
      include: { responder: true, agency: true },
    });

    const nextIncidentStatus = IncidentStatus.Assigned;
    await this.prisma.incident.update({
      where: { id },
      data: {
        assignedAgencyId: dto.agencyId,
        status: nextIncidentStatus as never,
        timeline: {
          create: {
            actorId: actor.sub,
            actorType: "admin",
            eventType: "incident.assigned",
            message: dto.reason ?? "Incident assigned through dispatch.",
            metadata: { assignmentId: assignment.id, agencyId: dto.agencyId, responderId: dto.responderId },
          },
        },
        statusHistory: {
          create: {
            fromStatus: incident.status as never,
            toStatus: nextIncidentStatus as never,
            note: dto.reason ?? "Incident assigned through dispatch.",
          },
        },
      } as never,
    });

    await this.recordDispatchEvent(id, actor, "assignment.created", dto.reason, {
      assignmentId: assignment.id,
      agencyId: dto.agencyId,
      responderId: dto.responderId,
    });

    await this.audit.record({
      actor,
      action: "assignment.created",
      entityType: "incident_assignments",
      entityId: assignment.id,
      reason: dto.overrideReason ?? dto.reason,
      afterState: { status: assignment.status, incidentId: id },
      metadata: { agencyId: dto.agencyId, responderId: dto.responderId },
    });

    await this.notifyAssignmentCreated(assignment, incident);

    return { data: assignment };
  }

  async escalateIncident(id: string, dto: EscalateDispatchIncidentDto, actor: JwtPayload) {
    this.assertDispatcher(actor);
    validateEscalateDispatchIncidentDto(dto);
    const incident = await this.prisma.incident.findFirst({
      where: { id, ...this.dispatchScopeWhere(actor) } as never,
    });
    if (!incident) throw new NotFoundException("Incident not found or outside dispatch scope");

    const escalation = await this.prisma.incidentEscalation.create({
      data: {
        incidentId: id,
        toAgencyId: dto.destinationAgencyId,
        toAdminId: dto.destinationAdminId,
        reason: dto.reason,
        metadata: { requestBackup: dto.requestBackup ?? false },
      } as never,
    });

    await this.recordDispatchEvent(id, actor, "incident.escalated", dto.reason, {
      escalationId: escalation.id,
      destinationAgencyId: dto.destinationAgencyId,
    });

    await this.audit.record({
      actor,
      action: "incident.escalated",
      entityType: "incidents",
      entityId: id,
      reason: dto.reason,
      metadata: { escalationId: escalation.id },
    });

    if (dto.destinationAdminId) {
      await this.notifications.create(
        {
          adminUserId: dto.destinationAdminId,
          incidentId: id,
          type: "AdminAssignmentAlert",
          priority: "Critical",
          channels: ["push", "in_app"],
          title: "Incident escalated",
          body: dto.reason,
        },
        actor,
      );
    }

    return { data: escalation };
  }

  async updateAssignment(id: string, dto: UpdateDispatchAssignmentDto, actor: JwtPayload) {
    validateUpdateDispatchAssignmentDto(dto);
    const assignment = await (this.prisma as any).incidentAssignment.findUnique({
      where: { id },
      include: { incident: true, responder: true },
    });
    if (!assignment) throw new NotFoundException("Assignment not found");

    this.assertAssignmentActor(assignment, actor);
    const currentStatus = assignment.status as IncidentAssignmentStatus;
    if (!canTransitionAssignment(currentStatus, dto.status)) {
      throw new BadRequestException(`Assignment cannot move from ${currentStatus} to ${dto.status}`);
    }

    if (assignment.expiresAt && dto.status === IncidentAssignmentStatus.Accepted && new Date() > assignment.expiresAt) {
      throw new BadRequestException("Assignment acceptance window expired");
    }

    const updateResult = await (this.prisma as any).incidentAssignment.updateMany({
      where: { id, version: dto.version },
      data: {
        status: dto.status,
        version: { increment: 1 },
        acceptedAt: dto.status === IncidentAssignmentStatus.Accepted ? new Date() : assignment.acceptedAt,
        declinedAt: dto.status === IncidentAssignmentStatus.Declined ? new Date() : assignment.declinedAt,
        enRouteAt:
          dto.status === IncidentAssignmentStatus.Accepted && !assignment.enRouteAt ? new Date() : assignment.enRouteAt,
        arrivedAt: dto.status === IncidentAssignmentStatus.Arrived ? new Date() : assignment.arrivedAt,
        completedAt: dto.status === IncidentAssignmentStatus.Completed ? new Date() : assignment.completedAt,
        declineReason: dto.declineReason,
        metadata: {
          ...(assignment.metadata ?? {}),
          note: dto.note,
        },
      },
    });
    if (updateResult.count === 0) throw new ConflictException("Assignment version conflict; refresh and retry");

    const updated = await (this.prisma as any).incidentAssignment.findUnique({
      where: { id },
      include: { incident: true, responder: true },
    });

    await this.syncIncidentFromAssignment(updated, dto.status, actor, dto.note);
    await this.syncResponderAvailability(updated, dto.status);
    await this.recordDispatchEvent(updated.incidentId, actor, `assignment.${dto.status.toLowerCase()}`, dto.note, {
      assignmentId: id,
      declineReason: dto.declineReason,
    });
    await this.audit.record({
      actor,
      action: `assignment.${dto.status.toLowerCase()}`,
      entityType: "incident_assignments",
      entityId: id,
      reason: dto.declineReason ?? dto.note,
      beforeState: { status: currentStatus, version: dto.version },
      afterState: { status: dto.status, version: dto.version + 1 },
    });

    await this.notifyAssignmentStatus(updated, dto.status);

    return { data: updated };
  }

  async listResponders(actor: JwtPayload, query: { agencyId?: string; availability?: string; limit?: string } = {}) {
    this.assertDispatchReader(actor);
    const where: Record<string, unknown> = { isActive: true, ...this.responderScopeWhere(actor) };
    if (query.agencyId?.trim()) where.agencyId = query.agencyId.trim();
    if (query.availability?.trim()) where.availability = query.availability.trim();

    const rows = await (this.prisma as any).responder.findMany({
      where,
      include: { agency: true },
      orderBy: [{ availability: "asc" }, { displayName: "asc" }],
      take: resolvePageLimit(query.limit),
    });
    return { data: rows };
  }

  async updateResponderStatus(id: string, dto: UpdateResponderAvailabilityDto, actor: JwtPayload) {
    validateUpdateResponderAvailabilityDto(dto);
    const responder = await (this.prisma as any).responder.findUnique({ where: { id }, include: { agency: true } });
    if (!responder) throw new NotFoundException("Responder not found");
    this.assertResponderActor(responder, actor);

    const updated = await (this.prisma as any).responder.update({
      where: { id },
      data: {
        availability: dto.availability,
        availabilityChangedAt: new Date(),
      },
    });

    await this.audit.record({
      actor,
      action: "responder.availability_changed",
      entityType: "responders",
      entityId: id,
      reason: dto.note,
      afterState: { availability: dto.availability },
    });

    return { data: updated };
  }

  private async syncIncidentFromAssignment(
    assignment: any,
    status: IncidentAssignmentStatus,
    actor: JwtPayload,
    note?: string,
  ) {
    let nextStatus: IncidentStatus | undefined;
    if (status === IncidentAssignmentStatus.Accepted) nextStatus = IncidentStatus.Responding;
    if (status === IncidentAssignmentStatus.Arrived) nextStatus = IncidentStatus.Responding;
    if (status === IncidentAssignmentStatus.Completed) nextStatus = IncidentStatus.Resolved;

    if (!nextStatus) return;
    const incident = assignment.incident;
    if (!canTransitionIncident(incident.status as IncidentStatus, nextStatus)) return;

    await this.prisma.incident.update({
      where: { id: incident.id },
      data: {
        status: nextStatus as never,
        resolvedAt: nextStatus === IncidentStatus.Resolved ? new Date() : undefined,
        timeline: {
          create: {
            actorId: actor.typ === "admin" ? actor.sub : actor.sub,
            actorType: actor.typ ?? "system",
            eventType: "incident.status_changed",
            message: note ?? `Incident status updated from assignment ${status}.`,
            metadata: { assignmentId: assignment.id, assignmentStatus: status, toStatus: nextStatus },
          },
        },
        statusHistory: {
          create: {
            fromStatus: incident.status as never,
            toStatus: nextStatus as never,
            note: note ?? `Assignment ${status}`,
          },
        },
      } as never,
    });
  }

  private async syncResponderAvailability(assignment: any, status: IncidentAssignmentStatus) {
    if (!assignment.responderId) return;
    const availabilityMap: Partial<Record<IncidentAssignmentStatus, ResponderAvailability>> = {
      [IncidentAssignmentStatus.Accepted]: ResponderAvailability.EnRoute,
      [IncidentAssignmentStatus.Arrived]: ResponderAvailability.OnScene,
      [IncidentAssignmentStatus.Completed]: ResponderAvailability.Available,
      [IncidentAssignmentStatus.Declined]: ResponderAvailability.Available,
      [IncidentAssignmentStatus.Cancelled]: ResponderAvailability.Available,
    };
    const availability = availabilityMap[status];
    if (!availability) return;
    await (this.prisma as any).responder.update({
      where: { id: assignment.responderId },
      data: { availability, availabilityChangedAt: new Date() },
    });
  }

  private async notifyAssignmentCreated(assignment: any, incident: any) {
    if (assignment.responder?.adminUserId) {
      await this.notifications.create({
        adminUserId: assignment.responder.adminUserId,
        incidentId: incident.id,
        type: "AdminAssignmentAlert",
        priority: "Critical",
        channels: ["push", "in_app"],
        title: "New incident assignment",
        body: `You have been assigned to ${incident.title}. Accept within ${ASSIGNMENT_ACCEPT_TIMEOUT_SECONDS / 60} minutes.`,
        metadata: { assignmentId: assignment.id },
      });
    } else if (assignment.responder?.userId) {
      await this.notifications.create({
        userId: assignment.responder.userId,
        incidentId: incident.id,
        type: "AdminAssignmentAlert",
        priority: "Critical",
        channels: ["push", "in_app"],
        title: "New incident assignment",
        body: `You have been assigned to ${incident.title}.`,
        metadata: { assignmentId: assignment.id },
      });
    }

    if (incident.reporterId && !incident.isAnonymous) {
      await this.notifications.create({
        userId: incident.reporterId,
        incidentId: incident.id,
        type: "IncidentStatusUpdate",
        priority: "High",
        channels: ["push", "in_app"],
        title: "Responder assigned",
        body: "A responder has been assigned to your emergency.",
        metadata: { assignmentId: assignment.id },
      });
    }
  }

  private async notifyAssignmentStatus(assignment: any, status: IncidentAssignmentStatus) {
    const incident = assignment.incident;
    if (!incident?.reporterId || incident.isAnonymous) return;

    const messages: Partial<Record<IncidentAssignmentStatus, { title: string; body: string }>> = {
      [IncidentAssignmentStatus.Accepted]: {
        title: "Responder accepted",
        body: "Your assigned responder accepted the emergency.",
      },
      [IncidentAssignmentStatus.Arrived]: {
        title: "Responder arrived",
        body: "Your assigned responder has arrived on scene.",
      },
      [IncidentAssignmentStatus.Completed]: {
        title: "Emergency resolved",
        body: "Your emergency response has been marked resolved.",
      },
    };
    const message = messages[status];
    if (!message) return;

    await this.notifications.create({
      userId: incident.reporterId,
      incidentId: incident.id,
      type: "IncidentStatusUpdate",
      priority: status === IncidentAssignmentStatus.Completed ? "High" : "Normal",
      channels: ["push", "in_app"],
      title: message.title,
      body: message.body,
      metadata: { assignmentId: assignment.id, assignmentStatus: status },
    });
  }

  private async recordDispatchEvent(
    incidentId: string,
    actor: JwtPayload | undefined,
    eventType: string,
    message?: string,
    metadata?: Record<string, unknown>,
  ) {
    await (this.prisma as any).dispatchEvent.create({
      data: {
        incidentId,
        actorAdminId: actor?.typ === "admin" ? actor.sub : undefined,
        eventType,
        message,
        metadata: metadata ?? {},
      },
    });
  }

  private async countNearbyDuplicates(incidentId: string, latitude: number, longitude: number) {
    try {
      const rows = await this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS count
           FROM incidents i
          WHERE i.id <> $1::uuid
            AND i.created_at >= NOW() - INTERVAL '24 hours'
            AND ST_DWithin(
              i.gps_location,
              ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
              250
            )`,
        incidentId,
        latitude,
        longitude,
      ) as Array<{ count: number }>;
      return Number(rows[0]?.count ?? 0);
    } catch {
      return 0;
    }
  }

  private async assertAgencyInScope(agencyId: string, actor: JwtPayload, jurisdictionId: string) {
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new NotFoundException("Agency not found");
    if ((agency as any).jurisdictionId !== jurisdictionId) {
      throw new BadRequestException("Agency is outside incident jurisdiction");
    }
    if (actor.role === AdminRoleName.AgencyAdmin && actor.agencyId && actor.agencyId !== agencyId) {
      throw new ForbiddenException("Agency admin cannot assign outside own agency");
    }
  }

  private async assertResponderAssignable(responderId: string, agencyId: string) {
    const responder = await (this.prisma as any).responder.findUnique({ where: { id: responderId } });
    if (!responder || !responder.isActive) throw new NotFoundException("Responder not found");
    if (responder.agencyId !== agencyId) throw new BadRequestException("Responder does not belong to selected agency");
    if (![ResponderAvailability.Available, ResponderAvailability.Busy].includes(responder.availability)) {
      throw new BadRequestException("Responder is not available for assignment");
    }
  }

  private assertDispatchReader(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Dispatch access requires admin authentication");
  }

  private assertDispatcher(actor: JwtPayload) {
    this.assertDispatchReader(actor);
    if (actor.role === AdminRoleName.OversightAuditor) {
      throw new ForbiddenException("Oversight Auditor cannot modify dispatch operations");
    }
    if (!actor.permissions?.includes("incident:assign")) {
      throw new ForbiddenException("incident:assign permission required");
    }
  }

  private assertAssignmentActor(assignment: any, actor: JwtPayload) {
    if (actor.typ === "admin") {
      if (assignment.responder?.adminUserId === actor.sub) return;
      this.assertDispatcher(actor);
      if (actor.role === AdminRoleName.AgencyAdmin && actor.agencyId && actor.agencyId !== assignment.agencyId) {
        throw new ForbiddenException("Assignment is outside agency scope");
      }
      return;
    }

    if (actor.typ === "user" && assignment.responder?.userId === actor.sub) return;
    throw new ForbiddenException("Not authorized to update this assignment");
  }

  private assertResponderActor(responder: any, actor: JwtPayload) {
    if (actor.typ === "admin") {
      this.assertDispatchReader(actor);
      if (actor.role === AdminRoleName.AgencyAdmin && actor.agencyId && actor.agencyId !== responder.agencyId) {
        throw new ForbiddenException("Responder is outside agency scope");
      }
      return;
    }
    if (actor.typ === "user" && responder.userId === actor.sub) return;
    throw new ForbiddenException("Not authorized to update this responder");
  }

  private dispatchScopeWhere(actor: JwtPayload) {
    if (actor.role === AdminRoleName.SuperAdmin) return {};
    if (actor.role === AdminRoleName.AgencyAdmin || actor.role === AdminRoleName.PoliceSecurityOfficer) {
      return actor.agencyId ? { OR: [{ assignedAgencyId: actor.agencyId }, { assignedAgencyId: null }] } : { id: "__deny__" };
    }
    if (actor.role === AdminRoleName.CountryAdmin) return { country: actor.country };
    if (actor.role === AdminRoleName.StateAdmin) return { country: actor.country, state: actor.state };
    if (actor.role === AdminRoleName.LgaAdmin) return { country: actor.country, state: actor.state, lga: actor.lga };
    return { id: "__deny__" };
  }

  private responderScopeWhere(actor: JwtPayload) {
    if (actor.role === AdminRoleName.SuperAdmin) return {};
    if (actor.role === AdminRoleName.AgencyAdmin || actor.role === AdminRoleName.PoliceSecurityOfficer) {
      return actor.agencyId ? { agencyId: actor.agencyId } : { id: "__deny__" };
    }
    if (actor.role === AdminRoleName.CountryAdmin) return { agency: { jurisdiction: { country: actor.country } } };
    if (actor.role === AdminRoleName.StateAdmin) {
      return { agency: { jurisdiction: { country: actor.country, state: actor.state } } };
    }
    if (actor.role === AdminRoleName.LgaAdmin) {
      return { agency: { jurisdiction: { country: actor.country, state: actor.state, lga: actor.lga } } };
    }
    return { id: "__deny__" };
  }

  private sanitizeIncidentForActor(incident: any, actor: JwtPayload) {
    if (incident.isAnonymous && actor.role !== AdminRoleName.SuperAdmin) {
      return {
        ...incident,
        reporterId: null,
        reporter: undefined,
      };
    }
    return incident;
  }
}
