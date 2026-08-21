import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AdminRoleName, IncidentStatus } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { DangerZoneDeliveryService } from "./danger-zone-delivery.service";
import { DangerZoneGeoService } from "./danger-zone-geo.service";
import {
  defaultRadiiForIncident,
  evaluateAlertEligibility,
} from "./danger-zone-eligibility";
import type { AllClearDangerZoneDto, CreateDangerZoneDto, UpdateDangerZoneDto } from "./dto/danger-zone.dto";
import { validateCreateDangerZoneDto } from "./dto/danger-zone.dto";

const ACTIVE_STATUSES = new Set([
  "ActiveCritical",
  "ActiveHigh",
  "ActiveModerate",
  "Contained",
  "Monitoring",
]);

@Injectable()
export class DangerZonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: DangerZoneGeoService,
    private readonly delivery: DangerZoneDeliveryService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateDangerZoneDto, actor: JwtPayload) {
    this.assertManage(actor);
    validateCreateDangerZoneDto(dto);
    const incident = await this.prisma.incident.findUnique({
      where: { id: dto.incidentId },
      include: { verifications: { orderBy: { createdAt: "desc" }, take: 5 } },
    });
    if (!incident) throw new NotFoundException("Incident not found");
    if (!this.adminCanAccessIncident(incident, actor)) throw new ForbiddenException("Incident is outside your scope");
    if (incident.latitude == null || incident.longitude == null) {
      throw new BadRequestException("Incident must have coordinates before creating a danger zone");
    }

    const latestVerification = incident.verifications[0];
    const eligibility = evaluateAlertEligibility({
      incidentType: String(incident.type),
      priority: String(incident.priority),
      status: String(incident.status),
      confidenceScore: Number(latestVerification?.confidence ?? 0),
      adminVerified: latestVerification?.method === "admin_manual_review" && latestVerification.result === "confirmed",
      agencyVerified: latestVerification?.method?.includes("agency") ?? false,
      emergencyOverride: dto.emergencyOverride === true,
      sourceCount: incident.verifications.length,
    });

    const radii = defaultRadiiForIncident(String(incident.type), String(incident.priority));
    const zone = await (this.prisma as any).dangerZone.create({
      data: {
        incidentId: incident.id,
        jurisdictionId: incident.jurisdictionId,
        createdByAdminId: actor.sub,
        status: eligibility.autoActivate ? "ActiveCritical" : "PendingVerification",
        severity: (dto.severity ?? eligibility.suggestedSeverity) as never,
        centerLatitude: incident.latitude,
        centerLongitude: incident.longitude,
        innerRadiusMeters: dto.innerRadiusMeters ?? radii.inner,
        warningRadiusMeters: dto.warningRadiusMeters ?? radii.warning,
        outerAwarenessRadiusMeters: dto.outerAwarenessRadiusMeters ?? radii.outer,
        publicMessage: dto.publicMessage ?? incident.title,
        avoidanceInstruction: dto.avoidanceInstruction ?? "Avoid the affected area and follow official instructions.",
        confidence: latestVerification?.confidence ?? 0,
        verificationMethod: latestVerification?.method ?? "pending",
        verifiedAt: eligibility.eligible ? new Date() : null,
        sourceCount: incident.verifications.length,
        country: incident.country,
        state: incident.state,
        lga: incident.lga,
        expiryTime: new Date(Date.now() + (dto.expiryMinutes ?? 360) * 60 * 1000),
        metadata: { eligibility },
      },
    });

    await this.geo.writeZoneGeography(
      zone.id,
      Number(incident.longitude),
      Number(incident.latitude),
      zone.innerRadiusMeters,
      zone.warningRadiusMeters,
      zone.outerAwarenessRadiusMeters,
    );

    await this.audit.record({
      actor,
      action: "danger_zone.created",
      entityType: "danger_zones",
      entityId: zone.id,
      metadata: { incidentId: incident.id, eligibility },
    });
    await this.syncDetectionState(zone.id, incident.id, "POTENTIAL", "DANGER_ZONE_PENDING_BACKEND_REVIEW");

    if (eligibility.autoActivate) {
      await this.activate(zone.id, actor, { skipApproval: true });
    }

    return { data: zone };
  }

  async list(actor: JwtPayload) {
    this.assertRead(actor);
    const zones = await (this.prisma as any).dangerZone.findMany({
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
      include: { incident: { select: { id: true, title: true, type: true, priority: true, status: true } } },
    });
    return { data: zones.filter((zone: { country: string; state: string; lga: string }) => this.adminCanAccessZone(zone, actor)) };
  }

  async get(id: string, actor: JwtPayload) {
    this.assertRead(actor);
    const zone = await (this.prisma as any).dangerZone.findUnique({
      where: { id },
      include: {
        incident: true,
        safetyAlerts: { orderBy: { activatedAt: "desc" }, take: 10 },
        allClearEvents: { orderBy: { issuedAt: "desc" }, take: 5 },
      },
    });
    if (!zone) throw new NotFoundException("Danger zone not found");
    if (!this.adminCanAccessZone(zone, actor)) throw new ForbiddenException("Danger zone is outside your scope");
    const affectedCount = await this.geo.countAffectedInZone(id);
    return { data: { ...zone, affectedCount } };
  }

  async update(id: string, dto: UpdateDangerZoneDto, actor: JwtPayload) {
    this.assertManage(actor);
    const zone = await this.getRecord(id, actor);
    const nextVersion = zone.version + 1;
    const updated = await (this.prisma as any).dangerZone.update({
      where: { id },
      data: {
        innerRadiusMeters: dto.innerRadiusMeters ?? zone.innerRadiusMeters,
        warningRadiusMeters: dto.warningRadiusMeters ?? zone.warningRadiusMeters,
        outerAwarenessRadiusMeters: dto.outerAwarenessRadiusMeters ?? zone.outerAwarenessRadiusMeters,
        publicMessage: dto.publicMessage ?? zone.publicMessage,
        avoidanceInstruction: dto.avoidanceInstruction ?? zone.avoidanceInstruction,
        severity: (dto.severity ?? zone.severity) as never,
        expiryTime: dto.expiryTime ? new Date(dto.expiryTime) : zone.expiryTime,
        version: nextVersion,
        lastReviewedAt: new Date(),
        reviewedByAdminId: actor.sub,
      },
    });
    await (this.prisma as any).dangerZoneVersion.create({
      data: {
        dangerZoneId: id,
        version: nextVersion,
        changeReason: "admin_update",
        innerRadiusMeters: updated.innerRadiusMeters,
        warningRadiusMeters: updated.warningRadiusMeters,
        outerAwarenessRadiusMeters: updated.outerAwarenessRadiusMeters,
      },
    });
    await this.geo.writeZoneGeography(
      id,
      Number(updated.centerLongitude),
      Number(updated.centerLatitude),
      updated.innerRadiusMeters,
      updated.warningRadiusMeters,
      updated.outerAwarenessRadiusMeters,
    );
    await this.audit.record({ actor, action: "danger_zone.updated", entityType: "danger_zones", entityId: id, metadata: dto as Record<string, unknown> });
    return { data: updated };
  }

  async activate(id: string, actor: JwtPayload, options: { skipApproval?: boolean } = {}) {
    this.assertManage(actor);
    const zone = await this.getRecord(id, actor);
    if (zone.status !== "PendingVerification" && !options.skipApproval) {
      throw new BadRequestException("Only pending zones can be activated through approval");
    }
    const status = zone.severity === "P1Immediate" ? "ActiveCritical" : zone.severity === "P2Serious" ? "ActiveHigh" : "ActiveModerate";
    const updated = await (this.prisma as any).dangerZone.update({
      where: { id },
      data: { status, activationTime: new Date(), reviewedByAdminId: actor.sub, lastReviewedAt: new Date() },
    });
    await this.delivery.enqueueZoneActivation(id);
    await this.syncDetectionState(id, zone.incidentId, "CONFIRMED", "DANGER_ZONE_CONFIRMED_BY_BACKEND_RULES");
    await this.audit.record({ actor, action: "danger_zone.activated", entityType: "danger_zones", entityId: id, metadata: { status } });
    return { data: updated };
  }

  async contain(id: string, actor: JwtPayload) {
    this.assertManage(actor);
    await this.getRecord(id, actor);
    const updated = await (this.prisma as any).dangerZone.update({
      where: { id },
      data: { status: "Contained", lastReviewedAt: new Date(), reviewedByAdminId: actor.sub },
    });
    await this.audit.record({ actor, action: "danger_zone.contained", entityType: "danger_zones", entityId: id, metadata: {} });
    return { data: updated };
  }

  async expand(id: string, dto: UpdateDangerZoneDto, actor: JwtPayload) {
    return this.update(
      id,
      {
        innerRadiusMeters: dto.innerRadiusMeters,
        warningRadiusMeters: dto.warningRadiusMeters,
        outerAwarenessRadiusMeters: dto.outerAwarenessRadiusMeters,
        publicMessage: dto.publicMessage,
        avoidanceInstruction: dto.avoidanceInstruction,
      },
      actor,
    );
  }

  async allClear(id: string, dto: AllClearDangerZoneDto, actor: JwtPayload) {
    this.assertManage(actor);
    const zone = await this.getRecord(id, actor);
    const updated = await (this.prisma as any).dangerZone.update({
      where: { id },
      data: {
        status: dto.status === "FalseAlertCancelled" ? "CancelledFalseReport" : "AllClear",
        lastReviewedAt: new Date(),
        reviewedByAdminId: actor.sub,
      },
    });
    const delivery = await this.delivery.deliverAllClear(id, actor.sub, dto.status, dto.reason);
    await this.syncDetectionState(
      id,
      zone.incidentId,
      dto.status === "FalseAlertCancelled" ? "REJECTED" : "RESOLVED",
      dto.status === "FalseAlertCancelled" ? "DANGER_ZONE_REJECTED_BY_BACKEND" : "DANGER_ZONE_RESOLVED_BY_BACKEND",
    );
    await this.audit.record({
      actor,
      action: "danger_zone.all_clear",
      entityType: "danger_zones",
      entityId: id,
      metadata: { ...dto, ...delivery },
    });
    return { data: updated, delivery };
  }

  async cancel(id: string, reason: string, actor: JwtPayload) {
    return this.allClear(id, { status: "FalseAlertCancelled", reason }, actor);
  }

  async evaluateIncidentForZone(incidentId: string, confidenceScore: number, verificationMethod: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: { verifications: true },
    });
    if (!incident) return { skipped: true, reason: "incident_not_found" };

    const eligibility = evaluateAlertEligibility({
      incidentType: String(incident.type),
      priority: String(incident.priority),
      status: String(incident.status),
      confidenceScore,
      adminVerified: verificationMethod === "admin_manual_review",
      sourceCount: incident.verifications.length,
    });
    if (!eligibility.eligible || !eligibility.autoActivate) return { skipped: true, reason: eligibility.reason };

    const existing = await (this.prisma as any).dangerZone.findFirst({
      where: {
        incidentId,
        status: { in: ["PendingVerification", "ActiveCritical", "ActiveHigh", "ActiveModerate", "Contained", "Monitoring"] },
      },
    });
    if (existing) return { skipped: true, reason: "zone_already_exists", zoneId: existing.id };

    const systemAdmin = await this.prisma.adminUser.findFirst({ orderBy: { createdAt: "asc" } });
    if (!systemAdmin) return { skipped: true, reason: "no_system_admin" };

    return this.create(
      { incidentId, emergencyOverride: confidenceScore >= 85 },
      { typ: "admin", sub: systemAdmin.id, role: AdminRoleName.SuperAdmin, permissions: ["broadcast:publish", "incident:update"] } as JwtPayload,
    );
  }

  async nearbyThreats(userId: string, latitude: number, longitude: number) {
    const zones = await this.geo.findActiveZonesNearPoint(longitude, latitude);
    return {
      data: zones.map((zone) => ({
        id: zone.id,
        incidentId: zone.incident_id,
        status: zone.status,
        severity: zone.severity,
        distanceMeters: Number(zone.distance_meters),
        publicMessage: zone.public_message,
        avoidanceInstruction: zone.avoidance_instruction,
        innerRadiusMeters: zone.inner_radius_meters,
        warningRadiusMeters: zone.warning_radius_meters,
        outerAwarenessRadiusMeters: zone.outer_awareness_radius_meters,
      })),
    };
  }

  async deliveryStats(id: string, actor: JwtPayload) {
    await this.get(id, actor);
    const rows = await (this.prisma as any).safetyAlertDelivery.groupBy({
      by: ["status"],
      where: { safetyAlert: { dangerZoneId: id } },
      _count: { _all: true },
    });
    return { data: rows };
  }

  async affectedDevices(id: string, actor: JwtPayload) {
    await this.get(id, actor);
    const devices = await this.geo.findAffectedDevices(id);
    return { data: devices, aggregateCount: devices.length };
  }

  async acknowledgeAlert(alertId: string, userId: string, deviceId?: string | null) {
    const alert = await (this.prisma as any).safetyAlert.findUnique({ where: { id: alertId } });
    if (!alert) throw new NotFoundException("Safety alert not found");
    const recipient = await (this.prisma as any).safetyAlertRecipient.findFirst({
      where: { safetyAlertId: alertId, userId, deviceId: deviceId ?? null },
    });
    if (!recipient) throw new NotFoundException("Alert recipient not found");
    await (this.prisma as any).safetyAlertAcknowledgement.upsert({
      where: { safetyAlertId_recipientId: { safetyAlertId: alertId, recipientId: recipient.id } },
      update: { acknowledgedAt: new Date() },
      create: { safetyAlertId: alertId, recipientId: recipient.id, userId, deviceId: deviceId ?? null },
    });
    await (this.prisma as any).safetyAlertRecipient.update({
      where: { id: recipient.id },
      data: { acknowledgedAt: new Date() },
    });
    return { acknowledged: true };
  }

  private async getRecord(id: string, actor: JwtPayload) {
    const zone = await (this.prisma as any).dangerZone.findUnique({ where: { id } });
    if (!zone) throw new NotFoundException("Danger zone not found");
    if (!this.adminCanAccessZone(zone, actor)) throw new ForbiddenException("Danger zone is outside your scope");
    return zone;
  }

  private async syncDetectionState(dangerZoneId: string, incidentId: string, state: string, resultingAction: string) {
    const assessments = (this.prisma as any).dangerDetectionAssessment;
    if (!assessments?.updateMany) return;
    await assessments.updateMany({
      where: { incidentId, state: { not: "FAILED" } },
      data: { dangerZoneId, state, resultingAction },
    });
  }

  private assertManage(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Admin access required");
    if (!actor.permissions?.includes("broadcast:publish") && actor.role !== AdminRoleName.SuperAdmin) {
      throw new ForbiddenException("broadcast:publish permission required");
    }
  }

  private assertRead(actor: JwtPayload) {
    if (actor.typ !== "admin" && actor.typ !== "user") throw new ForbiddenException("Authentication required");
    if (actor.typ === "admin" && !actor.permissions?.includes("incident:read") && actor.role !== AdminRoleName.SuperAdmin) {
      throw new ForbiddenException("incident:read permission required");
    }
  }

  private adminCanAccessZone(zone: { country: string; state: string; lga: string }, actor: JwtPayload) {
    if (actor.role === AdminRoleName.SuperAdmin) return true;
    if (actor.role === AdminRoleName.CountryAdmin) return zone.country === actor.country;
    if (actor.role === AdminRoleName.StateAdmin) return zone.country === actor.country && zone.state === actor.state;
    if (
      actor.role === AdminRoleName.LgaAdmin ||
      actor.role === AdminRoleName.CallCenterAgent ||
      actor.role === AdminRoleName.OversightAuditor ||
      actor.role === AdminRoleName.AgencyAdmin ||
      actor.role === AdminRoleName.PoliceSecurityOfficer
    ) {
      return zone.country === actor.country && zone.state === actor.state && zone.lga === actor.lga;
    }
    return false;
  }

  private adminCanAccessIncident(incident: { country: string; state: string; lga: string }, actor: JwtPayload) {
    return this.adminCanAccessZone(incident, actor);
  }
}
