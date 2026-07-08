import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AdminRoleName, IncidentPriority, IncidentStatus, IncidentType } from "@the-eye/shared";
import { randomUUID } from "crypto";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { canTransitionIncident } from "./incident-lifecycle";
import {
  ConfirmIncidentMediaDto,
  PresignIncidentMediaDto,
  ReportIncidentDto,
  validateMediaDraft,
  validateReportIncidentDto,
} from "./dto/report-incident.dto";

const DEFAULT_COUNTRY = "Nigeria";
const DEFAULT_STATE = "Lagos";
const DEFAULT_LGA = "Ikeja";

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor?: JwtPayload) {
    return {
      data: await this.prisma.incident.findMany({
        where: this.incidentScopeWhere(actor),
        include: { media: true, timeline: { orderBy: { createdAt: "desc" }, take: 10 } },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        take: 100,
      }),
    };
  }

  async reportEmergency(dto: ReportIncidentDto, actor?: JwtPayload) {
    return this.report({ ...dto, type: IncidentType.Emergency, priority: IncidentPriority.P1LifeThreatening, notifyEmergencyContacts: dto.notifyEmergencyContacts ?? true }, actor, true);
  }

  async report(dto: ReportIncidentDto, actor?: JwtPayload, emergencyFastPath = false) {
    validateReportIncidentDto(dto);

    const isAnonymous = dto.anonymous ?? !actor;
    if (!isAnonymous && actor?.typ !== "user" && actor?.typ !== "admin") {
      throw new BadRequestException("Identified reporting requires authentication");
    }

    const jurisdiction = await this.findJurisdiction(dto.manualLatitude ?? dto.latitude, dto.manualLongitude ?? dto.longitude, actor);
    const now = new Date();
    const incidentTitle = dto.title ?? this.defaultTitle(dto.type);
    const priority = dto.priority ?? this.defaultPriority(dto.type);

    const incident = await (this.prisma as any).incident.create({
      data: {
        reporterId: !isAnonymous && actor?.typ === "user" ? actor.sub : undefined,
        jurisdictionId: jurisdiction.id,
        type: dto.type as never,
        status: IncidentStatus.Submitted as never,
        priority: priority as never,
        title: incidentTitle,
        description: dto.description,
        address: dto.address,
        country: jurisdiction.country,
        state: jurisdiction.state,
        lga: jurisdiction.lga,
        latitude: dto.latitude,
        longitude: dto.longitude,
        manualLatitude: dto.manualLatitude,
        manualLongitude: dto.manualLongitude,
        manualAddress: dto.manualAddress,
        manualLocationAdjusted: dto.manualLatitude !== undefined && dto.manualLongitude !== undefined,
        isAnonymous,
        notifyEmergencyContacts: dto.notifyEmergencyContacts ?? false,
        submittedAt: now,
        metadata: {
          intake: emergencyFastPath ? "emergency_fast_path" : "standard",
          reportingMode: isAnonymous ? "anonymous" : "identified",
          emergencyContactNotificationRequested: dto.notifyEmergencyContacts ?? false,
        },
        timeline: {
          create: {
            actorId: !isAnonymous && actor?.typ === "user" ? actor.sub : undefined,
            actorType: isAnonymous ? "anonymous" : actor?.typ ?? "system",
            eventType: "incident.submitted",
            message: emergencyFastPath ? "Emergency report submitted through fast path." : "Incident report submitted.",
            metadata: { reportingMode: isAnonymous ? "anonymous" : "identified" },
          },
        },
      } as never,
    });

    await this.audit.record({
      actor,
      actorType: isAnonymous ? "anonymous" : actor?.typ ?? "system",
      action: "incident.created",
      entityType: "incidents",
      entityId: incident.id,
      afterState: { status: IncidentStatus.Submitted, priority, type: dto.type },
      metadata: { reportingMode: isAnonymous ? "anonymous" : "identified", emergencyFastPath },
    });

    if (dto.media?.length) {
      if (emergencyFastPath) {
        void this.attachInitialMedia(incident.id, dto.media, actor, isAnonymous, dto.latitude, dto.longitude);
      } else {
        await this.attachInitialMedia(incident.id, dto.media, actor, isAnonymous, dto.latitude, dto.longitude);
      }
    }

    if (dto.type === IncidentType.MissingPerson && dto.missingPerson) {
      await this.createMissingPersonReport(incident.id, dto, actor);
    }

    if (dto.type === IncidentType.StolenVehicle && dto.stolenVehicle) {
      await this.createStolenVehicleReport(incident.id, dto, actor);
    }

    if (dto.notifyEmergencyContacts && !isAnonymous && actor?.typ === "user") {
      void this.createEmergencyContactNotifications(actor.sub, incident.id, incidentTitle);
    }

    return {
      id: incident.id,
      status: incident.status,
      priority: incident.priority,
      submittedAt: incident.submittedAt,
      fastPath: emergencyFastPath,
      targetProcessingTimeMs: emergencyFastPath ? 3000 : undefined,
    };
  }

  async presignMedia(id: string, dto: PresignIncidentMediaDto, actor?: JwtPayload) {
    await this.get(id, actor);
    if (!dto.fileName || !dto.contentType || !dto.mediaType) throw new BadRequestException("fileName, contentType, and mediaType are required");

    const objectKey = `incident-media/${id}/${randomUUID()}-${dto.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    return {
      bucket: process.env.S3_BUCKET ?? "the-eye",
      objectKey,
      uploadUrl: `${process.env.S3_ENDPOINT ?? "http://localhost:9000"}/${process.env.S3_BUCKET ?? "the-eye"}/${objectKey}?presigned=replace-with-provider-signature`,
      requiredHeaders: { "content-type": dto.contentType },
      expiresInSeconds: 300,
    };
  }

  async confirmMedia(id: string, dto: ConfirmIncidentMediaDto, actor?: JwtPayload) {
    validateMediaDraft(dto);
    await this.get(id, actor);

    const media = await (this.prisma as any).incidentMedia.create({
      data: {
        incidentId: id,
        uploaderId: actor?.typ === "user" ? actor.sub : await this.systemUserId(),
        mediaType: dto.mediaType as never,
        bucket: dto.bucket,
        objectKey: dto.objectKey,
        contentType: dto.contentType,
        sizeBytes: dto.sizeBytes,
        fileHash: dto.fileHash,
        capturedAt: dto.capturedAt ? new Date(dto.capturedAt) : new Date(),
        latitude: dto.latitude ?? 0,
        longitude: dto.longitude ?? 0,
        metadata: dto.metadata ?? {},
      } as never,
    });

    await this.prisma.incidentTimeline.create({
      data: {
        incidentId: id,
        actorId: actor?.typ === "user" ? actor.sub : undefined,
        actorType: actor?.typ ?? "system",
        eventType: "incident.media_attached",
        message: `${dto.mediaType} evidence attached to incident.`,
        metadata: { mediaId: media.id, fileHash: dto.fileHash },
      },
    });

    return media;
  }

  async get(id: string, actor?: JwtPayload) {
    const incident = await this.prisma.incident.findFirst({
      where: { id, ...this.incidentScopeWhere(actor) },
      include: { media: true, timeline: { orderBy: { createdAt: "asc" } }, statusHistory: { orderBy: { createdAt: "asc" } } },
    });
    if (!incident) throw new NotFoundException("Incident not found or outside your scope");
    await this.audit.record({
      actor,
      action: "incident.viewed",
      entityType: "incidents",
      entityId: id,
      metadata: { status: incident.status, priority: incident.priority },
    });
    return incident;
  }

  async updateStatus(id: string, status: IncidentStatus, note?: string, actor?: JwtPayload) {
    if (actor?.role === AdminRoleName.OversightAuditor) throw new ForbiddenException("Oversight Auditor cannot modify incidents");
    if ((status === IncidentStatus.Closed || status === IncidentStatus.FalseReport) && !note?.trim()) {
      throw new BadRequestException("A reason is required to close an incident or mark it false");
    }

    const incident = await this.get(id, actor);
    const currentStatus = incident.status as IncidentStatus;
    if (!canTransitionIncident(currentStatus, status)) throw new BadRequestException(`Incident cannot move from ${currentStatus} to ${status}`);

    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        status: status as never,
        timeline: {
          create: {
            actorId: actor?.typ === "user" ? actor.sub : undefined,
            actorType: actor?.typ ?? "system",
            eventType: "incident.status_changed",
            message: note ?? `Status changed from ${currentStatus} to ${status}`,
            metadata: { fromStatus: currentStatus, toStatus: status },
          },
        },
      } as never,
    });

    const action = status === IncidentStatus.Closed ? "incident.closed" : status === IncidentStatus.FalseReport ? "incident.marked_false" : "incident.status_changed";
    await this.audit.record({
      actor,
      action,
      entityType: "incidents",
      entityId: id,
      reason: note,
      beforeState: { status: currentStatus },
      afterState: { status },
      metadata: { fromStatus: currentStatus, toStatus: status },
    });

    return updated;
  }

  async assign(id: string, dto: { agencyId?: string; adminId?: string; reason?: string }, actor?: JwtPayload) {
    if (actor?.role === AdminRoleName.OversightAuditor) throw new ForbiddenException("Oversight Auditor cannot modify incidents");
    const incident = await this.get(id, actor);
    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        assignedAgencyId: dto.agencyId,
        assignedAdminId: dto.adminId,
        status: IncidentStatus.Assigned as never,
        timeline: {
          create: {
            actorId: actor?.typ === "user" ? actor.sub : undefined,
            actorType: actor?.typ ?? "system",
            eventType: "incident.assigned",
            message: dto.reason ?? "Incident assigned.",
            metadata: { agencyId: dto.agencyId, adminId: dto.adminId },
          },
        },
      } as never,
    });
    await this.audit.record({
      actor,
      action: "incident.assigned",
      entityType: "incidents",
      entityId: id,
      reason: dto.reason,
      beforeState: { assignedAgencyId: incident.assignedAgencyId, assignedAdminId: incident.assignedAdminId, status: incident.status },
      afterState: { assignedAgencyId: dto.agencyId, assignedAdminId: dto.adminId, status: IncidentStatus.Assigned },
    });
    return updated;
  }

  async accessMedia(incidentId: string, mediaId: string, action: "view" | "download", actor?: JwtPayload) {
    await this.get(incidentId, actor);
    const media = await this.prisma.incidentMedia.findFirst({ where: { id: mediaId, incidentId } });
    if (!media) throw new NotFoundException("Incident evidence not found");
    await this.prisma.incidentMediaAccessLog.create({
      data: {
        mediaId,
        accessorId: actor?.typ === "user" ? actor.sub : undefined,
        adminUserId: actor?.typ === "admin" ? actor.sub : undefined,
        action,
        reason: action === "download" ? "Evidence downloaded for investigation" : "Evidence viewed",
      } as never,
    });
    await this.audit.record({
      actor,
      action: action === "download" ? "evidence.downloaded" : "evidence.viewed",
      entityType: "incident_media",
      entityId: mediaId,
      reason: action === "download" ? "Evidence downloaded for investigation" : "Evidence viewed",
      metadata: { incidentId, fileHash: media.fileHash, objectKey: media.objectKey },
    });
    return { data: media, access: action };
  }

  private async findJurisdiction(latitude: number, longitude: number, actor?: JwtPayload) {
    const matches = await this.prisma.$queryRaw<Array<{ id: string; country: string; state: string; lga: string }>>`
      SELECT id, country, state, lga
      FROM jurisdictions
      WHERE boundary IS NOT NULL
        AND ST_Covers(boundary, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography)
      LIMIT 1
    `;

    if (matches[0]) return matches[0];

    const fallback = await this.prisma.jurisdiction.findFirst({
      where: {
        country: actor?.country ?? DEFAULT_COUNTRY,
        state: actor?.state ?? DEFAULT_STATE,
        lga: actor?.lga ?? DEFAULT_LGA,
      },
    });

    if (!fallback) throw new BadRequestException("No jurisdiction found for incident location");
    return fallback;
  }

  private async attachInitialMedia(incidentId: string, mediaItems: NonNullable<ReportIncidentDto["media"]>, actor: JwtPayload | undefined, isAnonymous: boolean, fallbackLatitude: number, fallbackLongitude: number) {
    const uploaderId = !isAnonymous && actor?.typ === "user" ? actor.sub : await this.systemUserId();

    for (const media of mediaItems) {
      validateMediaDraft(media);
      await (this.prisma as any).incidentMedia.create({
        data: {
          incidentId,
          uploaderId,
          mediaType: media.mediaType as never,
          bucket: media.bucket,
          objectKey: media.objectKey,
          contentType: media.contentType,
          sizeBytes: media.sizeBytes,
          fileHash: media.fileHash,
          capturedAt: media.capturedAt ? new Date(media.capturedAt) : new Date(),
          latitude: media.latitude ?? fallbackLatitude,
          longitude: media.longitude ?? fallbackLongitude,
          metadata: media.metadata ?? {},
        } as never,
      });
    }

    await this.prisma.incidentTimeline.create({
      data: {
        incidentId,
        actorId: !isAnonymous && actor?.typ === "user" ? actor.sub : undefined,
        actorType: isAnonymous ? "anonymous" : actor?.typ ?? "system",
        eventType: "incident.media_batch_attached",
        message: `${mediaItems.length} evidence file(s) attached at submission.`,
      },
    });
  }

  private async createMissingPersonReport(incidentId: string, dto: ReportIncidentDto, actor?: JwtPayload) {
    const missing = dto.missingPerson!;
    await this.prisma.missingPersonReport.create({
      data: {
        reporterId: dto.anonymous ? undefined : actor?.typ === "user" ? actor.sub : undefined,
        incidentId,
        fullName: missing.fullName,
        age: missing.age,
        gender: missing.gender,
        description: missing.description ?? dto.description,
        lastSeenAt: missing.lastSeenAt ? new Date(missing.lastSeenAt) : undefined,
        lastSeenAddress: missing.lastSeenAddress ?? dto.manualAddress ?? dto.address,
        latitude: dto.manualLatitude ?? dto.latitude,
        longitude: dto.manualLongitude ?? dto.longitude,
      } as never,
    });
  }

  private async createStolenVehicleReport(incidentId: string, dto: ReportIncidentDto, actor?: JwtPayload) {
    const vehicle = dto.stolenVehicle!;
    const storedVehicle = await this.prisma.vehicle.upsert({
      where: { plateNumber: vehicle.plateNumber },
      update: { vin: vehicle.vin, make: vehicle.make, model: vehicle.model, color: vehicle.color, year: vehicle.year },
      create: {
        ownerId: dto.anonymous ? undefined : actor?.typ === "user" ? actor.sub : undefined,
        plateNumber: vehicle.plateNumber,
        vin: vehicle.vin,
        make: vehicle.make,
        model: vehicle.model,
        color: vehicle.color,
        year: vehicle.year,
      },
    });

    await this.prisma.stolenVehicleReport.create({
      data: {
        vehicleId: storedVehicle.id,
        reporterId: dto.anonymous ? undefined : actor?.typ === "user" ? actor.sub : undefined,
        incidentId,
        lastSeenAt: vehicle.lastSeenAt ? new Date(vehicle.lastSeenAt) : undefined,
        lastSeenArea: vehicle.lastSeenArea ?? dto.manualAddress ?? dto.address,
        latitude: dto.manualLatitude ?? dto.latitude,
        longitude: dto.manualLongitude ?? dto.longitude,
      } as never,
    });
  }

  private async createEmergencyContactNotifications(userId: string, incidentId: string, title: string) {
    const contacts = await this.prisma.emergencyContact.findMany({ where: { userId }, orderBy: { priority: "asc" }, take: 5 });
    if (!contacts.length) return;

    await this.prisma.notification.createMany({
      data: contacts.map((contact) => ({
        userId,
        incidentId,
        type: "FamilySosAlert",
        priority: "Critical",
        channel: "sms",
        title: "Emergency report submitted",
        body: `${contact.name} should be notified: ${title}`,
        status: "Pending" as never,
        provider: "emergency-contact-adapter",
      })),
    });
  }

  private async systemUserId() {
    const user = await this.prisma.user.upsert({
      where: { email: "system@theeye.local" },
      update: {},
      create: { email: "system@theeye.local", passwordHash: "system" },
    });
    return user.id;
  }

  private defaultTitle(type: IncidentType) {
    return `${type} report`;
  }

  private defaultPriority(type: IncidentType) {
    if ([IncidentType.Emergency, IncidentType.Fire, IncidentType.Kidnapping].includes(type)) return IncidentPriority.P1LifeThreatening;
    if ([IncidentType.Crime, IncidentType.Accident, IncidentType.Abuse].includes(type)) return IncidentPriority.P2ActiveCrimeAccident;
    if (type === IncidentType.SuspiciousActivity) return IncidentPriority.P3SuspiciousActivity;
    return IncidentPriority.P4GeneralSafety;
  }

  private incidentScopeWhere(actor?: JwtPayload) {
    if (!actor) return { id: "__deny_all__" };
    if (actor.typ === "user") return { reporterId: actor.sub };
    if (actor.role === AdminRoleName.SuperAdmin) return {};
    if (actor.role === AdminRoleName.CountryAdmin) return { country: actor.country };
    if (actor.role === AdminRoleName.StateAdmin) return { country: actor.country, state: actor.state };
    if (actor.role === AdminRoleName.LgaAdmin || actor.role === AdminRoleName.CallCenterAgent || actor.role === AdminRoleName.OversightAuditor) return { country: actor.country, state: actor.state, lga: actor.lga };
    if (actor.role === AdminRoleName.AgencyAdmin || actor.role === AdminRoleName.PoliceSecurityOfficer) return { assignedAgencyId: actor.agencyId ?? "__no_agency__" };
    return { id: "__deny_all__" };
  }
}



