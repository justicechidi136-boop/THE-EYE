import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { IncidentAssignmentStatus, IncidentStatus } from "@the-eye/shared";
import {
  citizenAssignmentStatusLabel,
  citizenIncidentCategoryLabel,
  citizenLocationQualityLabel,
  citizenTimelineMessage,
  citizenWitnessSummary,
} from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { CommunityVerificationService } from "../community-verification/community-verification.service";
import { IncidentCommunicationsService } from "../incident-communications/incident-communications.service";
import { IncidentsService } from "./incidents.service";
import {
  buildIncidentPresentation,
  TERMINAL_ROUTE_TYPE,
} from "./incident-presentation.mapper";
import { isActiveIncidentStatus } from "./incident-lifecycle";

function deriveLiveVideoCard(session: {
  id: string;
  status: string;
  startedAt: Date | null;
  endedAt: Date | null;
} | null | undefined) {
  if (!session) {
    return {
      sessionId: null as string | null,
      status: "NotStarted",
      displayState: "NotStarted" as const,
      userDisplayState: "Preparing camera",
      startedAt: null as string | null,
      endedAt: null as string | null,
      durationSeconds: null as number | null,
      connectionStatus: "Not connected",
      participantCount: 0,
      retryAvailable: true,
    };
  }

  const startedAt = session.startedAt?.toISOString() ?? null;
  const endedAt = session.endedAt?.toISOString() ?? null;
  const durationSeconds =
    session.startedAt != null
      ? Math.max(
          0,
          Math.floor(
            ((session.endedAt ?? new Date()).getTime() - session.startedAt.getTime()) / 1000,
          ),
        )
      : null;

  let displayState:
    | "NotStarted"
    | "Connecting"
    | "Streaming"
    | "Disconnected"
    | "RetryAvailable"
    | "Completed" = "Connecting";
  let userDisplayState = "Preparing camera";
  if (session.status === "Ended" || session.endedAt) {
    displayState = "Completed";
    userDisplayState = "Ended";
  } else if (session.status === "Active" && session.startedAt) {
    displayState = "Streaming";
    userDisplayState = "Live";
  } else if (session.status === "Failed") {
    displayState = "RetryAvailable";
    userDisplayState = "Connection interrupted";
  } else if (session.status === "Disconnected") {
    displayState = "Disconnected";
    userDisplayState = "Connection interrupted";
  } else if (session.status === "Pending" || session.status === "Starting") {
    userDisplayState = "Connecting";
  }

  return {
    sessionId: session.id,
    status: session.status,
    displayState,
    userDisplayState,
    startedAt,
    endedAt,
    durationSeconds,
    connectionStatus:
      displayState === "Streaming"
        ? "Connected"
        : displayState === "Completed"
          ? "Ended"
          : displayState === "RetryAvailable"
            ? "Failed"
            : "Not connected",
    participantCount: displayState === "Streaming" ? 1 : 0,
    retryAvailable: displayState !== "Streaming" && displayState !== "Connecting",
  };
}

@Injectable()
export class ActiveEmergencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly incidentsService: IncidentsService,
    private readonly communityVerification: CommunityVerificationService,
    private readonly incidentCommunications: IncidentCommunicationsService,
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
      const communication = await this.incidentCommunications.getCommunicationSummary(
        incidentId,
        actor!,
      );
      return {
        isActive: false,
        routeType: TERMINAL_ROUTE_TYPE,
        incidentId: incident.id,
        publicReference: presentation.publicReference,
        status,
        displayLabel: presentation.displayLabel,
        statusVersion: incident.statusVersion,
        resolutionSummary: presentation.resolutionSummary ?? null,
        cancellationSummary: presentation.cancellationSummary ?? null,
        communication,
      };
    }

    const activeAssignment = incident.assignments[0] ?? null;
    const metadata = (incident.metadata ?? {}) as Record<string, unknown>;
    const reporterConfidence =
      (metadata.confidence as string | undefined) ??
      (metadata.reporterConfidence as string | undefined) ??
      null;
    const locationSource =
      (metadata.locationSource as string | undefined) ??
      (incident.manualLocationAdjusted ? "manual" : "gps");
    const locationQuality =
      (metadata.locationQuality as string | undefined) ??
      (incident.latitude != null ? "reported" : "pending");

    const liveSession = incident.liveVideoSessions[0];
    const communityAggregate = await this.communityVerification.getIncidentAggregate(incidentId);
    const communication = await this.incidentCommunications.getCommunicationSummary(incidentId, actor!);

    const witnessCount = incident.verifications.filter(
      (v) => v.method.includes("nearby") || v.method.includes("crowd"),
    ).length;
    const latestConfidence = incident.verifications[0]?.confidence?.toString() ?? null;

    return {
      isActive: true,
      routeType: "OWN_ACTIVE_INCIDENT",
      incidentId: incident.id,
      publicReference: presentation.publicReference,
      ownership: "reporter",
      category: incident.type,
      categoryLabel: citizenIncidentCategoryLabel(incident.type),
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
        locationLabel: citizenLocationQualityLabel({
          quality: locationQuality,
          source: locationSource,
          latitude: incident.latitude?.toString() ?? null,
          longitude: incident.longitude?.toString() ?? null,
        }),
        liveLocationStale: incident.liveLocationStale,
        liveLocationUpdatedAt: incident.liveLocationUpdatedAt?.toISOString() ?? null,
      },
      evidenceSummary: {
        totalCount: incident.media.length,
        photos: incident.media.filter((m) => m.mediaType === "Image").length,
        videos: incident.media.filter((m) => m.mediaType === "Video").length,
        voice: incident.media.filter((m) => m.mediaType === "Audio").length,
      },
      evidenceItems: incident.media.map((item) => ({
        id: item.id,
        mediaType: item.mediaType,
        uploadedAt: item.uploadedAt.toISOString(),
        durationSeconds: item.durationSeconds,
      })),
      reporterConfidence: reporterConfidence,
      status,
      displayLabel: presentation.displayLabel,
      statusVersion: incident.statusVersion,
      progressStep: presentation.progressStep,
      progressStages: presentation.progressStages,
      allowedActions: presentation.allowedActions,
      timelineSummary: incident.timeline.map((entry) => ({
        id: entry.id,
        eventType: entry.eventType,
        message: citizenTimelineMessage({
          eventType: entry.eventType,
          message: entry.message,
        }),
        createdAt: entry.createdAt.toISOString(),
      })),
      assignedAgency: incident.assignedAgency
        ? { id: incident.assignedAgency.id, name: incident.assignedAgency.name }
        : null,
      assignment: activeAssignment
        ? {
            id: activeAssignment.id,
            status: activeAssignment.status,
            statusLabel: citizenAssignmentStatusLabel(activeAssignment.status),
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
      liveVideo: deriveLiveVideoCard(liveSession),
      communityVerificationSummary: {
        witnessCount,
        latestConfidence,
        witnessSummary: citizenWitnessSummary({ witnessCount, latestConfidence }),
        ...communityAggregate,
      },
      cancellationSummary: presentation.cancellationSummary,
      resolutionSummary: presentation.resolutionSummary ?? null,
      lastUpdatedAt: incident.updatedAt.toISOString(),
      communication,
    };
  }
}
