import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AdminRoleName, IncidentStatus } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { LOCATION_STALE_SECONDS } from "./assignment-lifecycle";

export type LocationUpdateInput = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  capturedAt?: string;
  sequenceNumber?: number;
  speedMps?: number;
  headingDegrees?: number;
  batteryLevel?: number;
  networkType?: string;
  sourceDeviceId?: string;
};

const TERMINAL_INCIDENT_STATUSES = new Set<string>([IncidentStatus.Resolved, IncidentStatus.Closed, IncidentStatus.FalseReport]);

@Injectable()
export class LocationTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async recordCitizenLocation(incidentId: string, dto: LocationUpdateInput, actor?: JwtPayload) {
    this.validateCoordinates(dto);
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new NotFoundException("Incident not found");
    if (TERMINAL_INCIDENT_STATUSES.has(String(incident.status))) {
      throw new BadRequestException("Location streaming is not allowed for closed incidents");
    }
    if (actor?.typ === "user" && incident.reporterId !== actor.sub) {
      throw new ForbiddenException("Only the reporting citizen can update this incident location stream");
    }

    const capturedAt = dto.capturedAt ? new Date(dto.capturedAt) : new Date();
    this.assertTimestampBounds(capturedAt);

    if (dto.sequenceNumber !== undefined) {
      const duplicate = await (this.prisma as any).incidentLocationUpdate.findFirst({
        where: { incidentId, sequenceNumber: dto.sequenceNumber },
      });
      if (duplicate) return this.toCitizenLiveLocation(duplicate, incident);
      const latest = await this.latestCitizenSequence(incidentId);
      if (latest !== null && dto.sequenceNumber <= latest) {
        throw new BadRequestException("Out-of-order location sequence rejected");
      }
    }

    const update = await (this.prisma as any).incidentLocationUpdate.create({
      data: {
        incidentId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracyMeters,
        capturedAt,
        sourceDeviceId: dto.sourceDeviceId,
        sequenceNumber: dto.sequenceNumber ?? 0,
        metadata: {
          speedMps: dto.speedMps,
          headingDegrees: dto.headingDegrees,
          batteryLevel: dto.batteryLevel,
          networkType: dto.networkType,
        },
      },
    });

    await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        latitude: dto.latitude,
        longitude: dto.longitude,
        liveLocationUpdatedAt: capturedAt,
        liveLocationStale: false,
      } as never,
    });

    return this.toCitizenLiveLocation(update, incident, capturedAt);
  }

  async recordResponderLocation(assignmentId: string, dto: LocationUpdateInput, actor: JwtPayload) {
    this.validateCoordinates(dto);
    const assignment = await (this.prisma as any).incidentAssignment.findUnique({
      where: { id: assignmentId },
      include: { responder: true, incident: true },
    });
    if (!assignment) throw new NotFoundException("Assignment not found");
    this.assertResponderAssignmentAccess(assignment, actor);

    const capturedAt = dto.capturedAt ? new Date(dto.capturedAt) : new Date();
    this.assertTimestampBounds(capturedAt);

    if (dto.sequenceNumber !== undefined) {
      const duplicate = await (this.prisma as any).responderLocationUpdate.findFirst({
        where: { assignmentId, sequenceNumber: dto.sequenceNumber },
      });
      if (duplicate) return this.toResponderLiveLocation(duplicate, assignment);
      const latest = await this.latestResponderSequence(assignmentId);
      if (latest !== null && dto.sequenceNumber <= latest) {
        throw new BadRequestException("Out-of-order location sequence rejected");
      }
    }

    const update = await (this.prisma as any).responderLocationUpdate.create({
      data: {
        assignmentId,
        responderId: assignment.responderId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyMeters: dto.accuracyMeters,
        capturedAt,
        sequenceNumber: dto.sequenceNumber ?? 0,
        metadata: {
          speedMps: dto.speedMps,
          headingDegrees: dto.headingDegrees,
          batteryLevel: dto.batteryLevel,
          networkType: dto.networkType,
          sourceDeviceId: dto.sourceDeviceId,
        },
      },
    });

    if (assignment.responderId) {
      await (this.prisma as any).responder.update({
        where: { id: assignment.responderId },
        data: {
          lastLatitude: dto.latitude,
          lastLongitude: dto.longitude,
          lastLocationAt: capturedAt,
          lastLocationAccuracyMeters: dto.accuracyMeters,
        },
      });
    }

    return this.toResponderLiveLocation(update, assignment, capturedAt);
  }

  async getCitizenLiveLocation(incidentId: string, actor?: JwtPayload) {
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new NotFoundException("Incident not found");
    this.assertLocationReader(incident, actor);

    const latest = await (this.prisma as any).incidentLocationUpdate.findFirst({
      where: { incidentId },
      orderBy: [{ capturedAt: "desc" }, { sequenceNumber: "desc" }],
    });
    if (!latest) return { data: null, stale: true };

    const capturedAt = new Date(latest.capturedAt);
    const stale = this.isStale(capturedAt, (incident as any).liveLocationStale);
    return { data: this.toCitizenLiveLocation(latest, incident, capturedAt), stale };
  }

  async getResponderLiveLocation(assignmentId: string, actor: JwtPayload) {
    const assignment = await (this.prisma as any).incidentAssignment.findUnique({
      where: { id: assignmentId },
      include: { responder: true, incident: true },
    });
    if (!assignment) throw new NotFoundException("Assignment not found");
    this.assertLocationReader(assignment.incident, actor, assignment);

    const latest = await (this.prisma as any).responderLocationUpdate.findFirst({
      where: { assignmentId },
      orderBy: [{ capturedAt: "desc" }, { sequenceNumber: "desc" }],
    });
    if (!latest) return { data: null, stale: true };
    const capturedAt = new Date(latest.capturedAt);
    return { data: this.toResponderLiveLocation(latest, assignment, capturedAt), stale: this.isStale(capturedAt) };
  }

  async getCitizenLocationHistory(incidentId: string, actor: JwtPayload | undefined, limit = 50, cursor?: string) {
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new NotFoundException("Incident not found");
    this.assertLocationReader(incident, actor);

    const pageSize = Math.min(Math.max(limit, 1), 100);
    const rows = await (this.prisma as any).incidentLocationUpdate.findMany({
      where: { incidentId },
      orderBy: [{ capturedAt: "desc" }, { sequenceNumber: "desc" }],
      take: pageSize + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > pageSize;
    const data = rows.slice(0, pageSize).map((row: any) => ({
      id: row.id,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      accuracyMeters: row.accuracy ? Number(row.accuracy) : null,
      capturedAt: row.capturedAt,
      sequenceNumber: row.sequenceNumber,
    }));

    return { data, nextCursor: hasMore ? rows[pageSize - 1]?.id : null };
  }

  private assertLocationReader(incident: any, actor?: JwtPayload, assignment?: any) {
    if (!actor) throw new ForbiddenException("Authentication required");
    if (actor.typ === "user") {
      if (incident.reporterId !== actor.sub) throw new ForbiddenException("Location access denied");
      return;
    }
    if (actor.typ === "admin") {
      if (actor.role === AdminRoleName.OversightAuditor) return;
      if (assignment?.responder?.adminUserId === actor.sub) return;
      if (actor.role === AdminRoleName.AgencyAdmin && actor.agencyId && incident.assignedAgencyId !== actor.agencyId) {
        throw new ForbiddenException("Location access outside agency scope");
      }
      return;
    }
    throw new ForbiddenException("Location access denied");
  }

  private assertResponderAssignmentAccess(assignment: any, actor: JwtPayload) {
    if (actor.typ === "user" && assignment.responder?.userId === actor.sub) return;
    if (actor.typ === "admin" && assignment.responder?.adminUserId === actor.sub) return;
    if (actor.typ === "admin" && actor.permissions?.includes("incident:assign")) {
      if (actor.role === AdminRoleName.AgencyAdmin && actor.agencyId && actor.agencyId !== assignment.agencyId) {
        throw new ForbiddenException("Assignment outside agency scope");
      }
      return;
    }
    throw new ForbiddenException("Not authorized to update assignment location");
  }

  private validateCoordinates(dto: LocationUpdateInput) {
    if (typeof dto.latitude !== "number" || dto.latitude < -90 || dto.latitude > 90) {
      throw new BadRequestException("latitude must be between -90 and 90");
    }
    if (typeof dto.longitude !== "number" || dto.longitude < -180 || dto.longitude > 180) {
      throw new BadRequestException("longitude must be between -180 and 180");
    }
    if (dto.accuracyMeters !== undefined && dto.accuracyMeters < 0) {
      throw new BadRequestException("accuracyMeters must be non-negative");
    }
  }

  private assertTimestampBounds(capturedAt: Date) {
    const now = Date.now();
    if (capturedAt.getTime() > now + 60_000) throw new BadRequestException("capturedAt cannot be in the future");
    if (capturedAt.getTime() < now - 24 * 60 * 60 * 1000) throw new BadRequestException("capturedAt is too old");
  }

  private isStale(capturedAt: Date, forcedStale = false) {
    if (forcedStale) return true;
    return Date.now() - capturedAt.getTime() > LOCATION_STALE_SECONDS * 1000;
  }

  private async latestCitizenSequence(incidentId: string) {
    const latest = await (this.prisma as any).incidentLocationUpdate.findFirst({
      where: { incidentId },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });
    return latest?.sequenceNumber ?? null;
  }

  private async latestResponderSequence(assignmentId: string) {
    const latest = await (this.prisma as any).responderLocationUpdate.findFirst({
      where: { assignmentId },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });
    return latest?.sequenceNumber ?? null;
  }

  private toCitizenLiveLocation(update: any, incident: any, capturedAt?: Date) {
    return {
      incidentId: incident.id,
      latitude: Number(update.latitude),
      longitude: Number(update.longitude),
      accuracyMeters: update.accuracy ? Number(update.accuracy) : null,
      capturedAt: capturedAt ?? update.capturedAt,
      sequenceNumber: update.sequenceNumber,
      staleAfterSeconds: LOCATION_STALE_SECONDS,
    };
  }

  private toResponderLiveLocation(update: any, assignment: any, capturedAt?: Date) {
    return {
      assignmentId: assignment.id,
      incidentId: assignment.incidentId,
      responderId: assignment.responderId,
      latitude: Number(update.latitude),
      longitude: Number(update.longitude),
      accuracyMeters: update.accuracyMeters ? Number(update.accuracyMeters) : null,
      capturedAt: capturedAt ?? update.capturedAt,
      sequenceNumber: update.sequenceNumber,
      staleAfterSeconds: LOCATION_STALE_SECONDS,
    };
  }
}
