import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { JwtPayload } from "../../common/auth/jwt";
import { buildCommunityVerificationNotificationMetadata } from "../notifications/notification-routing.schema";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  DEFAULT_VERIFICATION_LIMIT,
  DEFAULT_VERIFICATION_RADIUS_METERS,
  DEFAULT_VERIFICATION_REQUEST_TTL_MINUTES,
  INCIDENT_TYPE_DISPLAY,
  approximateDistanceLabel,
} from "./community-verification.constants";
import { CommunityVerificationEligibilityService } from "./community-verification-eligibility.service";
import { CommunityVerificationSafePayloadService } from "./community-verification-safe-payload.service";
import { CommunityVerificationScoringService } from "./community-verification-scoring.service";
import type {
  AcceptCommunityRecommendationDto,
  CommunityVerificationRespondDto,
  CommunityVerificationSkipDto,
  ExtendCommunityVerificationDto,
  FlagCommunityVerificationResponseDto,
  IssueCommunityVerificationDto,
  RevokeCommunityVerificationDto,
} from "./dto/community-verification.dto";

const TERMINAL_REQUEST_STATUSES = new Set(["Responded", "Skipped", "Expired", "Revoked", "Cancelled"]);

@Injectable()
export class CommunityVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: CommunityVerificationEligibilityService,
    private readonly safePayload: CommunityVerificationSafePayloadService,
    private readonly scoring: CommunityVerificationScoringService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async issueRequests(incidentId: string, dto: IssueCommunityVerificationDto = {}, actor?: JwtPayload) {
    const evaluation = await this.eligibility.evaluateIncidentEligibility(incidentId, {
      radiusMeters: dto.radiusMeters ?? DEFAULT_VERIFICATION_RADIUS_METERS,
      limit: dto.limit ?? DEFAULT_VERIFICATION_LIMIT,
    });
    if (!evaluation.eligible) {
      return { incidentId, issued: 0, reason: evaluation.reason ?? "Not eligible" };
    }

    const incident = await this.prisma.incident.findUniqueOrThrow({
      where: { id: incidentId },
      select: { id: true, type: true },
    });
    const ttlMinutes = dto.ttlMinutes ?? DEFAULT_VERIFICATION_REQUEST_TTL_MINUTES;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
    const issuedAt = new Date();
    let issued = 0;

    for (const candidate of evaluation.candidates) {
      const request = await this.prisma.communityVerificationRequest.create({
        data: {
          incidentId,
          targetUserId: candidate.userId,
          status: "Pending" as never,
          issuedAt,
          expiresAt,
          approximateDistanceMeters: candidate.distanceMeters,
          distanceBand: this.toDistanceBand(candidate.distanceMeters),
          metadata: { passiveOnly: evaluation.passiveOnly === true },
        },
      });

      const category = String(incident.type);
      const title = `Nearby ${INCIDENT_TYPE_DISPLAY[category] ?? category} Reported`;
      const body = `A ${INCIDENT_TYPE_DISPLAY[category]?.toLowerCase() ?? category.toLowerCase()} has been reported ${approximateDistanceLabel(candidate.distanceMeters)} from your location. Can you help verify it safely?`;
      const metadata = buildCommunityVerificationNotificationMetadata({
        incidentId,
        verificationRequestId: request.id,
        category,
        distanceBand: this.toDistanceBand(candidate.distanceMeters),
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });

      const notification = await this.prisma.notification.create({
        data: {
          userId: candidate.userId,
          incidentId,
          channel: "push",
          type: "NearbyIncidentVerification",
          title,
          body,
          status: "Pending" as never,
          provider: "fcm",
          metadata,
        },
      });

      await this.prisma.communityVerificationRequest.update({
        where: { id: request.id },
        data: { notificationId: notification.id, status: "Delivered" as never, deliveryStatus: "Queued" },
      });

      await this.notifications.enqueue({
        notificationId: notification.id,
        userId: candidate.userId,
        channel: "push",
        title,
        body,
        incidentId,
        type: "NearbyIncidentVerification",
        provider: "fcm",
      });
      issued += 1;
    }

    await this.prisma.incidentTimeline.create({
      data: {
        incidentId,
        actorId: actor?.typ === "user" ? actor.sub : undefined,
        actorType: actor?.typ ?? "system",
        eventType: "incident.community_verification_requested",
        message: `Community verification requested from ${issued} nearby user(s).`,
        metadata: { issued, passiveOnly: evaluation.passiveOnly === true },
      },
    });

    return { incidentId, issued, passiveOnly: evaluation.passiveOnly === true, expiresAt: expiresAt.toISOString() };
  }

  async getSafePayload(requestId: string, actor: JwtPayload) {
    const request = await this.loadOwnedRequest(requestId, actor.sub);
    await this.expireIfNeeded(request);
    return this.buildPayloadForRequest(request);
  }

  async listPending(actor: JwtPayload) {
    const rows = await this.prisma.communityVerificationRequest.findMany({
      where: {
        targetUserId: actor.sub,
        status: { in: ["Pending", "Delivered", "Opened"] as never[] },
        expiresAt: { gt: new Date() },
      },
      include: {
        response: true,
        incident: {
          select: {
            type: true,
            description: true,
            country: true,
            state: true,
            lga: true,
            submittedAt: true,
            assignments: { where: { status: { in: ["Assigned", "EnRoute", "OnScene", "Active"] as never[] } }, take: 1 },
            media: {
              where: { deletedAt: null, moderationStatus: "Approved" as never },
              select: { id: true, mediaType: true },
              take: 3,
            },
          },
        },
      },
      orderBy: { issuedAt: "desc" },
      take: 20,
    });
    return {
      data: rows.map((row) => this.buildPayloadForRequest(row)),
    };
  }

  async markOpened(requestId: string, actor: JwtPayload) {
    const request = await this.loadOwnedRequest(requestId, actor.sub);
    await this.expireIfNeeded(request);
    this.assertAnswerable(request);
    if (request.status === "Delivered" || request.status === "Pending") {
      await this.prisma.communityVerificationRequest.update({
        where: { id: requestId },
        data: { status: "Opened" as never, openedAt: new Date() },
      });
    }
    return { requestId, status: "Opened", openedAt: new Date().toISOString() };
  }

  async respond(requestId: string, dto: CommunityVerificationRespondDto, actor: JwtPayload) {
    const existingByAction = await this.prisma.communityVerificationResponse.findUnique({
      where: { clientActionId: dto.clientActionId },
    });
    if (existingByAction) {
      if (existingByAction.requestId !== requestId || existingByAction.userId !== actor.sub) {
        throw new BadRequestException("clientActionId already used");
      }
      return this.completionContract(requestId, existingByAction.responseType as string);
    }

    const request = await this.loadOwnedRequest(requestId, actor.sub);
    await this.expireIfNeeded(request);
    this.assertAnswerable(request);

    if (request.response) {
      return this.completionContract(requestId, request.response.responseType as string);
    }

    const incident = await this.prisma.incident.findUniqueOrThrow({
      where: { id: request.incidentId },
      select: {
        reporterId: true,
        type: true,
        assignments: { where: { status: { in: ["Assigned", "EnRoute", "OnScene", "Active"] as never[] } }, take: 1 },
      },
    });
    if (incident.reporterId === actor.sub) throw new ForbiddenException("Reporter cannot verify own incident");

    const passiveOnly = this.safePayload.isPassiveOnly(String(incident.type), incident.assignments.length > 0);
    if (
      passiveOnly &&
      !["StillOngoing", "AppearsResolved", "UnsafeToVerify", "Skipped", "Unsure"].includes(dto.responseType)
    ) {
      throw new BadRequestException("Response type not allowed for this incident category");
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.sub },
      include: { trustedReporter: true },
    });
    const duplicateDevice = await this.hasDuplicateDevice(actor.sub, request.incidentId);
    const trustWeight = this.scoring.computeTrustWeight({
      accountAgeDays: Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000),
      trustedReporter: Boolean(user.trustedReporter && !user.trustedReporter.revokedAt),
      duplicateDevice,
      locationQuality: dto.locationQuality,
    });

    await this.prisma.communityVerificationResponse.create({
      data: {
        requestId,
        incidentId: request.incidentId,
        userId: actor.sub,
        responseType: dto.responseType as never,
        confidence: dto.confidence as never,
        note: dto.note,
        voiceAttachmentId: dto.voiceAttachmentId,
        locationQuality: dto.locationQuality,
        locationSource: dto.locationSource,
        approximateDistanceAtResponse: request.approximateDistanceMeters,
        trustWeight,
        clientActionId: dto.clientActionId,
      },
    });

    await this.prisma.communityVerificationRequest.update({
      where: { id: requestId },
      data: { status: "Responded" as never, respondedAt: new Date() },
    });

    await this.prisma.incidentTimeline.create({
      data: {
        incidentId: request.incidentId,
        actorId: actor.sub,
        actorType: "user",
        eventType: "incident.community_verification_received",
        message: "Community verification response received.",
        metadata: { responseType: dto.responseType, requestId },
      },
    });

    return this.completionContract(requestId, dto.responseType);
  }

  async skip(requestId: string, dto: CommunityVerificationSkipDto, actor: JwtPayload) {
    const request = await this.loadOwnedRequest(requestId, actor.sub);
    await this.expireIfNeeded(request);
    this.assertAnswerable(request);

    const existingByAction = await this.prisma.communityVerificationResponse.findUnique({
      where: { clientActionId: dto.clientActionId },
    });
    if (existingByAction) {
      return this.completionContract(requestId, "Skipped");
    }

    await this.prisma.communityVerificationResponse.create({
      data: {
        requestId,
        incidentId: request.incidentId,
        userId: actor.sub,
        responseType: "Skipped" as never,
        clientActionId: dto.clientActionId,
        note: dto.reason,
        trustWeight: 0,
      },
    });
    await this.prisma.communityVerificationRequest.update({
      where: { id: requestId },
      data: { status: "Skipped" as never, respondedAt: new Date() },
    });
    return this.completionContract(requestId, "Skipped");
  }

  async getIncidentAggregate(incidentId: string) {
    const [requests, responses, score] = await Promise.all([
      this.prisma.communityVerificationRequest.groupBy({
        by: ["status"],
        where: { incidentId },
        _count: true,
      }),
      this.prisma.communityVerificationResponse.groupBy({
        by: ["responseType"],
        where: { incidentId, flaggedSuspicious: false },
        _count: true,
      }),
      this.scoring.scoreIncident(incidentId),
    ]);

    const countByStatus = Object.fromEntries(requests.map((row) => [row.status, row._count]));
    const countByResponse = Object.fromEntries(responses.map((row) => [row.responseType, row._count]));
    const lastUpdate = await this.prisma.communityVerificationResponse.findFirst({
      where: { incidentId },
      orderBy: { submittedAt: "desc" },
      select: { submittedAt: true },
    });

    return {
      requestsSent: Object.values(countByStatus).reduce((sum, n) => sum + n, 0),
      responsesReceived: Object.values(countByResponse).reduce((sum, n) => sum + n, 0),
      confirmedCount: countByResponse.Confirmed ?? 0,
      notFoundCount: countByResponse.NotFound ?? 0,
      ongoingCount: countByResponse.StillOngoing ?? 0,
      resolvedCount: countByResponse.AppearsResolved ?? 0,
      confidenceLevel: score.confidenceLevel,
      conflictDetected: score.conflictScore >= 1,
      lastCommunityUpdateAt: lastUpdate?.submittedAt?.toISOString() ?? null,
      safeSummaryText: score.safeSummaryText,
      recommendation: score.recommendation,
      reviewRequired: score.reviewRequired,
    };
  }

  async adminAnalytics(jurisdictionFilter?: { country?: string; state?: string; lga?: string }) {
    const incidentWhere = jurisdictionFilter?.country
      ? {
          country: jurisdictionFilter.country,
          ...(jurisdictionFilter.state ? { state: jurisdictionFilter.state } : {}),
          ...(jurisdictionFilter.lga ? { lga: jurisdictionFilter.lga } : {}),
        }
      : undefined;
    const requestWhere = incidentWhere ? { incident: incidentWhere } : {};
    const responseWhere = incidentWhere ? { incident: incidentWhere } : {};
    const [requests, responses, suspicious] = await Promise.all([
      this.prisma.communityVerificationRequest.count({ where: requestWhere }),
      this.prisma.communityVerificationResponse.count({ where: responseWhere }),
      this.prisma.communityVerificationResponse.count({
        where: { flaggedSuspicious: true, ...responseWhere },
      }),
    ]);
    const distribution = await this.prisma.communityVerificationResponse.groupBy({
      by: ["responseType"],
      where: responseWhere,
      _count: true,
    });
    return {
      requestsIssued: requests,
      responsesReceived: responses,
      suspiciousResponses: suspicious,
      responseDistribution: Object.fromEntries(distribution.map((row) => [row.responseType, row._count])),
    };
  }

  async adminListIncidentRequests(incidentId: string) {
    const rows = await this.prisma.communityVerificationRequest.findMany({
      where: { incidentId },
      include: { response: true },
      orderBy: { issuedAt: "desc" },
      take: 100,
    });
    const score = await this.scoring.scoreIncident(incidentId);
    return { score, requests: rows };
  }

  async adminRevoke(requestId: string, dto: RevokeCommunityVerificationDto, actor: JwtPayload) {
    await this.prisma.communityVerificationRequest.update({
      where: { id: requestId },
      data: {
        status: "Revoked" as never,
        revokedAt: new Date(),
        revokedByAdminId: actor.sub,
        metadata: { revokeReason: dto.reason ?? null },
      },
    });
    await this.audit.record({
      actor,
      action: "community_verification.revoke",
      entityType: "community_verification_request",
      entityId: requestId,
      metadata: { reason: dto.reason ?? null },
    });
    return { requestId, status: "Revoked" };
  }

  async adminExtendExpiry(requestId: string, dto: ExtendCommunityVerificationDto, actor: JwtPayload) {
    const request = await this.prisma.communityVerificationRequest.findUniqueOrThrow({ where: { id: requestId } });
    const expiresAt = new Date(request.expiresAt.getTime() + dto.extendMinutes * 60_000);
    await this.prisma.communityVerificationRequest.update({
      where: { id: requestId },
      data: {
        expiresAt,
        status: request.status === "Expired" ? ("Delivered" as never) : request.status,
      },
    });
    await this.audit.record({
      actor,
      action: "community_verification.extend_expiry",
      entityType: "community_verification_request",
      entityId: requestId,
      metadata: { extendMinutes: dto.extendMinutes, expiresAt: expiresAt.toISOString() },
    });
    return { requestId, expiresAt: expiresAt.toISOString() };
  }

  async adminFlagResponse(responseId: string, dto: FlagCommunityVerificationResponseDto, actor: JwtPayload) {
    await this.prisma.communityVerificationResponse.update({
      where: { id: responseId },
      data: { flaggedSuspicious: dto.flagged, metadata: { flagReason: dto.reason ?? null } },
    });
    await this.audit.record({
      actor,
      action: "community_verification.flag_response",
      entityType: "community_verification_response",
      entityId: responseId,
      metadata: dto as Record<string, unknown>,
    });
    return { responseId, flaggedSuspicious: dto.flagged };
  }

  async adminAcceptRecommendation(incidentId: string, dto: AcceptCommunityRecommendationDto, actor: JwtPayload) {
    await this.audit.record({
      actor,
      action: "community_verification.recommendation_review",
      entityType: "incident",
      entityId: incidentId,
      metadata: dto as Record<string, unknown>,
    });
    return { incidentId, decision: dto.decision, note: "Incident status unchanged by policy" };
  }

  /** @internal test helper */
  async loadOwnedRequestInternal(requestId: string, userId: string) {
    return this.loadOwnedRequest(requestId, userId);
  }

  private async loadOwnedRequest(requestId: string, userId: string) {
    const request = await this.prisma.communityVerificationRequest.findUnique({
      where: { id: requestId },
      include: {
        response: true,
        incident: {
          select: {
            type: true,
            description: true,
            country: true,
            state: true,
            lga: true,
            submittedAt: true,
            assignments: { where: { status: { in: ["Assigned", "EnRoute", "OnScene", "Active"] as never[] } }, take: 1 },
            media: {
              where: { deletedAt: null, moderationStatus: "Approved" as never },
              select: { id: true, mediaType: true, objectKey: true, bucket: true },
              take: 3,
            },
          },
        },
      },
    });
    if (!request || request.targetUserId !== userId) throw new NotFoundException();
    return request;
  }

  private buildPayloadForRequest(request: {
    id: string;
    status: string;
    expiresAt: Date;
    approximateDistanceMeters: number | null;
    distanceBand: string | null;
    response?: { responseType: string } | null;
    incident: {
      type: unknown;
      description: string | null;
      country: string;
      state: string;
      lga: string;
      submittedAt: Date;
      assignments: unknown[];
      media: Array<{ id: string; mediaType: unknown }>;
    };
  }) {
    const isExpired = request.expiresAt.getTime() <= Date.now() || request.status === "Expired";
    const passiveOnly = this.safePayload.isPassiveOnly(
      String(request.incident.type),
      request.incident.assignments.length > 0,
    );
    return this.safePayload.buildSafePayload({
      requestId: request.id,
      incidentType: String(request.incident.type),
      country: request.incident.country,
      state: request.incident.state,
      lga: request.incident.lga,
      submittedAt: request.incident.submittedAt,
      description: request.incident.description,
      approximateDistanceMeters: request.approximateDistanceMeters,
      distanceBand: request.distanceBand ? String(request.distanceBand) : null,
      expiresAt: request.expiresAt,
      passiveOnly,
      alreadyResponded: Boolean(request.response) || TERMINAL_REQUEST_STATUSES.has(String(request.status)),
      isExpired,
      evidencePreviews: request.incident.media.map((item) => ({
        id: item.id,
        mediaType: String(item.mediaType),
      })),
    });
  }

  private assertAnswerable(request: { status: string; expiresAt: Date; response?: unknown | null }) {
    if (["Revoked", "Cancelled"].includes(String(request.status))) {
      throw new BadRequestException("Request is no longer active");
    }
    if (request.expiresAt.getTime() <= Date.now() || request.status === "Expired") {
      throw new BadRequestException("Request has expired");
    }
    if (request.response || TERMINAL_REQUEST_STATUSES.has(String(request.status))) {
      throw new BadRequestException("Request already completed");
    }
  }

  private async expireIfNeeded(request: { id: string; status: string; expiresAt: Date }) {
    if (request.expiresAt.getTime() <= Date.now() && !TERMINAL_REQUEST_STATUSES.has(String(request.status))) {
      await this.prisma.communityVerificationRequest.update({
        where: { id: request.id },
        data: { status: "Expired" as never },
      });
      request.status = "Expired";
    }
  }

  private completionContract(requestId: string, responseType: string) {
    return {
      requestId,
      completed: true,
      responseType,
      message: "Thank you for helping verify this incident safely.",
      nextRoute: "/home",
    };
  }

  private toDistanceBand(distanceMeters: number) {
    if (distanceMeters <= 100) return "WITHIN_100_M" as const;
    if (distanceMeters <= 250) return "WITHIN_250_M" as const;
    if (distanceMeters <= 500) return "WITHIN_500_M" as const;
    if (distanceMeters <= 1000) return "WITHIN_1_KM" as const;
    return "BEYOND_1_KM" as const;
  }

  private async hasDuplicateDevice(userId: string, incidentId: string) {
    const tokens = await this.prisma.userPushToken.findMany({
      where: { userId, isActive: true, deviceId: { not: null } },
      select: { deviceId: true },
    });
    const deviceIds = tokens.map((t) => t.deviceId).filter(Boolean) as string[];
    if (!deviceIds.length) return false;
    const dup = await this.prisma.communityVerificationResponse.findFirst({
      where: {
        incidentId,
        userId: { not: userId },
        user: { pushTokens: { some: { deviceId: { in: deviceIds } } } },
      },
      select: { id: true },
    });
    return Boolean(dup);
  }
}
