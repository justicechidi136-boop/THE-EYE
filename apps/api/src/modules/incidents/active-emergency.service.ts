import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { IncidentAssignmentStatus, IncidentStatus } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { IncidentsService } from "./incidents.service";
import {
  buildIncidentPresentation,
  TERMINAL_ROUTE_TYPE,
} from "./incident-presentation.mapper";
import { isActiveIncidentStatus } from "./incident-lifecycle";

@Injectable()
export class ActiveEmergencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly incidentsService: IncidentsService,
  ) {}

  async getActiveEmergency(incidentId: string, actor?: JwtPayload) {
    if (actor?.typ === "user") {
      const owned = await this.prisma.incident.findFirst({
        where: { id: incidentId, reporterId: actor.sub },
        select: { id: true },
      });
      if (!owned) {
        throw new NotFoundException("Incident not found or outside your scope");
      }
    } else if (actor?.typ === "admin") {
      await this.incidentsService.get(incidentId, actor);
    } else {
      throw new ForbiddenException("Authentication required");
    }

    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        assignedAgency: { select: { id: true, name: true } },
        media: {
          select: {
            id: true,
            mediaType: true,
            uploadedAt: true,
            durationSeconds: true,
          },
          orderBy: { uploadedAt: "asc" },
        },
        statusHistory: { orderBy: { createdAt: "asc" } },
        timeline: { orderBy: { createdAt: "desc" }, take: 20 },
        assignments: {
          where: {
            status: {
              notIn: [
                IncidentAssignmentStatus.Completed,
                IncidentAssignmentStatus.Cancelled,
                IncidentAssignmentStatus.Declined,
                IncidentAssignmentStatus.Reassigned,
              ],
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            responder: { select: { id: true, displayName: true } },
            agency: { select: { id: true, name: true } },
          },
        },
        liveVideoSessions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, startedAt: true, endedAt: true },
        },
        verifications: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            method: true,
            result: true,
            confidence: true,
            createdAt: true,
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException("Incident not found");
    }

    const status = incident.status as IncidentStatus;
    const presentation = buildIncidentPresentation(
      incident as Parameters<typeof buildIncidentPresentation>[0],
      actor,
      incident.assignments[0] as Parameters<typeof buildIncidentPresentation>[2] ?? null,
    );

    if (!isActiveIncidentStatus(status)) {
      return {
        isActive: false,
        routeType: TERMINAL_ROUTE_TYPE,
        incidentId: incident.id,
        status,
        displayLabel: presentation.displayLabel,
        statusVersion: incident.statusVersion,
        resolutionSummary: presentation.resolutionSummary ?? null,
        cancellationSummary: presentation.cancellationSummary ?? null,
      };
    }

    const activeAssignment = incident.assignments[0] ?? null;
    const metadata = (incident.metadata ?? {}) as Record<string, unknown>;
    const locationSource =
      (metadata.locationSource as string | undefined) ??
      (incident.manualLocationAdjusted ? "manual" : "gps");
    const locationQuality =
      (metadata.locationQuality as string | undefined) ??
      (incident.latitude != null ? "reported" : "pending");

    const liveSession = incident.liveVideoSessions[0];

    return {
      isActive: true,
      routeType: "OWN_ACTIVE_INCIDENT",
      incidentId: incident.id,
      ownership: "reporter",
      category: incident.type,
      description: incident.description,
      title: incident.title,
      reportedAt: incident.submittedAt.toISOString(),
      reportedLocation: {
        latitude: incident.latitude?.toString() ?? null,
        longitude: incident.longitude?.toString() ?? null,
        address: incident.address,
        manualLocationAdjusted: incident.manualLocationAdjusted,
        source: locationSource,
        quality: locationQuality,
        liveLocationStale: incident.liveLocationStale,
        liveLocationUpdatedAt: incident.liveLocationUpdatedAt?.toISOString() ?? null,
      },
      evidenceSummary: {
        totalCount: incident.media.length,
        photos: incident.media.filter((m) => m.mediaType === "Image").length,
        videos: incident.media.filter((m) => m.mediaType === "Video").length,
        voice: incident.media.filter((m) => m.mediaType === "Audio").length,
      },
      status,
      displayLabel: presentation.displayLabel,
      statusVersion: incident.statusVersion,
      progressStep: presentation.progressStep,
      progressStages: presentation.progressStages,
      allowedActions: presentation.allowedActions,
      timelineSummary: incident.timeline.map((entry) => ({
        id: entry.id,
        eventType: entry.eventType,
        message: entry.message,
        createdAt: entry.createdAt.toISOString(),
      })),
      assignedAgency: incident.assignedAgency
        ? { id: incident.assignedAgency.id, name: incident.assignedAgency.name }
        : null,
      assignment: activeAssignment
        ? {
            id: activeAssignment.id,
            status: activeAssignment.status,
            responder: activeAssignment.responder
              ? {
                  id: activeAssignment.responder.id,
                  displayName: activeAssignment.responder.displayName,
                }
              : null,
            agency: activeAssignment.agency
              ? { id: activeAssignment.agency.id, name: activeAssignment.agency.name }
              : null,
          }
        : null,
      responderEtaMinutes: null,
      liveVideo: liveSession
        ? {
            sessionId: liveSession.id,
            status: liveSession.status,
            startedAt: liveSession.startedAt?.toISOString() ?? null,
            endedAt: liveSession.endedAt?.toISOString() ?? null,
          }
        : null,
      communityVerificationSummary: {
        witnessCount: incident.verifications.filter(
          (v) => v.method.includes("nearby") || v.method.includes("crowd"),
        ).length,
        latestConfidence: incident.verifications[0]?.confidence?.toString() ?? null,
      },
      cancellationSummary: presentation.cancellationSummary,
      resolutionSummary: presentation.resolutionSummary ?? null,
      lastUpdatedAt: incident.updatedAt.toISOString(),
    };
  }
}
