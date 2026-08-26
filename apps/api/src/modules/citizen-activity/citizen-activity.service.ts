import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BroadcastType,
  IncidentStatus,
  buildIncidentPublicReference,
} from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import {
  buildCursorPage,
  resolvePageLimit,
} from "../../common/pagination/cursor-pagination";
import { IncidentTimelineService } from "../dispatch/incident-timeline.service";
import { CommunityVerificationService } from "../community-verification/community-verification.service";
import { LIVE_BROADCAST_STATUSES } from "../broadcasts/broadcasts.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  broadcastLifecycleBucket,
  buildBroadcastTimelinePreview,
  classifyBroadcastKind,
  classifyIncidentKind,
  decodeActivityCursor,
  encodeActivityCursor,
  incidentLifecycleBucket,
  latestTimelinePreviewEntry,
  matchesActivitySection,
  resolveBroadcastNavigation,
  resolveIncidentNavigation,
  type ActivityKind,
  type ActivityNavigationDestination,
  type ActivitySourceType,
} from "./citizen-activity.mapper";
import { parseActivityHistoryQuery, type ActivityHistoryQuery } from "./dto/activity-history.dto";
import { isActiveIncidentStatus } from "../incidents/incident-lifecycle";

type UnifiedActivityRow = {
  sourceType: ActivitySourceType;
  kind: ActivityKind;
  id: string;
  sortAt: Date;
  lifecycle: "active" | "resolved" | "cancelled";
  payload: Record<string, unknown>;
};

@Injectable()
export class CitizenActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly incidentTimeline: IncidentTimelineService,
    private readonly communityVerification: CommunityVerificationService,
  ) {}

  async listActivityHistory(actor: JwtPayload, rawQuery: ActivityHistoryQuery) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
    const query = parseActivityHistoryQuery(rawQuery);
    const limit = resolvePageLimit(query.limit, 25);
    if (query.cursor && !decodeActivityCursor(query.cursor)) {
      throw new BadRequestException("cursor is invalid");
    }

    const [incidents, broadcasts, unreadByIncident, unreadByBroadcast] = await Promise.all([
      this.fetchReporterIncidents(actor.sub, query),
      this.fetchCreatorBroadcasts(actor.sub, query),
      this.unreadCountsByIncident(actor.sub),
      this.unreadCountsByBroadcast(actor.sub),
    ]);

    const merged = [
      ...incidents.map((row) => this.mapIncidentRow(row, unreadByIncident)),
      ...broadcasts.map((row) => this.mapBroadcastRow(row, unreadByBroadcast)),
    ]
      .filter((item) => matchesActivitySection(query.section, item))
      .filter((item) => this.matchesSearch(query, item))
      .sort((a, b) => {
        const delta = b.sortAt.getTime() - a.sortAt.getTime();
        if (delta !== 0) return delta;
        return `${b.sourceType}:${b.id}`.localeCompare(`${a.sourceType}:${a.id}`);
      });

    const cursor = decodeActivityCursor(query.cursor);
    const filtered = cursor
      ? merged.filter((item) => {
          const itemTime = item.sortAt.getTime();
          const cursorTime = cursor.sortAt.getTime();
          if (itemTime < cursorTime) return true;
          if (itemTime > cursorTime) return false;
          return `${item.sourceType}:${item.id}` < `${cursor.sourceType}:${cursor.id}`;
        })
      : merged;

    const page = buildCursorPage(filtered, limit, (item) =>
      encodeActivityCursor(item.sortAt, item.sourceType, item.id),
    );

    const timelineByIncident = await this.buildIncidentTimelinePreviews(
      page.data.filter((item) => item.sourceType === "incident").map((item) => item.id),
    );

    return {
      data: page.data.map((item) =>
        item.sourceType === "incident"
          ? this.toIncidentActivityItem(item, timelineByIncident.get(item.id) ?? [])
          : this.toBroadcastActivityItem(item),
      ),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      limit: page.limit,
      meta: {
        section: query.section,
        totalMatched: filtered.length,
      },
    };
  }

  async getIncidentArchive(id: string, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
    const incident = await this.prisma.incident.findFirst({
      where: { id, reporterId: actor.sub },
      include: {
        media: { where: { deletedAt: null }, orderBy: { uploadedAt: "asc" } },
        verifications: { orderBy: { createdAt: "asc" } },
        assignedAgency: true,
        reporter: { include: { profile: true } },
        broadcasts: { where: { deletedAt: null }, select: { id: true, type: true, title: true, status: true } },
        assignments: {
          orderBy: { createdAt: "asc" },
          include: { agency: true, responder: true },
        },
      },
    });
    if (!incident) throw new NotFoundException("Incident archive not found");

    const metadata = (incident.metadata ?? {}) as Record<string, unknown>;
    const [timeline, communityVerificationSummary] = await Promise.all([
      this.incidentTimeline.buildTimeline(id, "citizen", actor),
      this.communityVerification.getIncidentAggregate(id),
    ]);

    const latestVerification = incident.verifications.at(-1);
    const terminalCommunityVerificationSummary = this.toTerminalCommunityVerificationSummary(
      communityVerificationSummary,
      String(incident.status),
    );
    const arrivalAssignment = incident.assignments.find((row) => row.arrivedAt);
    const archiveTimeline: Array<Record<string, unknown>> = [
      ...(timeline.data ?? []),
    ];
    if (
      incident.cancelledAt &&
      !archiveTimeline.some((entry) => String(entry.type).toLowerCase().includes("cancel"))
    ) {
      archiveTimeline.push({
        at: incident.cancelledAt,
        type: "incident.cancelled",
        label: incident.cancellationReason
          ? `Incident cancelled: ${incident.cancellationReason}`
          : "Incident cancelled",
      });
    }
    if (
      incident.closedAt &&
      !archiveTimeline.some((entry) => String(entry.type).toLowerCase().includes("closed"))
    ) {
      archiveTimeline.push({
        at: incident.closedAt,
        type: "incident.closed",
        label: "Incident closed",
      });
    }
    archiveTimeline.sort(
      (a, b) => new Date(String(a.at)).getTime() - new Date(String(b.at)).getTime(),
    );

    return {
      data: {
        archive: true,
        readOnly: true,
        incidentId: incident.id,
        publicReference: buildIncidentPublicReference({
          incidentId: incident.id,
          submittedAt: incident.submittedAt,
        }),
        category: incident.type,
        kind: classifyIncidentKind(String(incident.type), metadata),
        reporter: incident.isAnonymous
          ? { mode: "anonymous" }
          : {
              mode: "identified",
              displayName: incident.reporter?.profile
                ? `${incident.reporter.profile.firstName} ${incident.reporter.profile.lastName}`.trim()
                : "Reporter",
            },
        createdAt: incident.submittedAt.toISOString(),
        resolvedAt: incident.resolvedAt?.toISOString() ?? null,
        closedAt: incident.closedAt?.toISOString() ?? null,
        cancelledAt: incident.cancelledAt?.toISOString() ?? null,
        status: incident.status,
        title: incident.title,
        description: incident.description,
        location: {
          address: incident.address ?? incident.manualAddress,
          latitude: incident.latitude ? Number(incident.latitude) : incident.manualLatitude ? Number(incident.manualLatitude) : null,
          longitude: incident.longitude ? Number(incident.longitude) : incident.manualLongitude ? Number(incident.manualLongitude) : null,
          jurisdiction: [incident.lga, incident.state, incident.country].filter(Boolean).join(", "),
          accuracyMeters:
            typeof metadata.locationAccuracyMeters === "number"
              ? metadata.locationAccuracyMeters
              : null,
          capturedAt:
            typeof metadata.locationCapturedAt === "string"
              ? metadata.locationCapturedAt
              : incident.submittedAt.toISOString(),
        },
        map: {
          latitude: incident.latitude ? Number(incident.latitude) : incident.manualLatitude ? Number(incident.manualLatitude) : null,
          longitude: incident.longitude ? Number(incident.longitude) : incident.manualLongitude ? Number(incident.manualLongitude) : null,
        },
        evidenceGallery: incident.media.map((item) => ({
          id: item.id,
          mediaType: item.mediaType,
          capturedAt: item.capturedAt.toISOString(),
          uploadedAt: item.uploadedAt.toISOString(),
          contentType: item.contentType,
          durationSeconds: item.durationSeconds,
        })),
        videos: incident.media
          .filter((item) => String(item.mediaType).toLowerCase().includes("video"))
          .map((item) => ({ id: item.id, capturedAt: item.capturedAt.toISOString(), durationSeconds: item.durationSeconds })),
        voiceRecordings: incident.media
          .filter((item) => String(item.mediaType).toLowerCase().includes("voice") || String(item.mediaType).toLowerCase().includes("audio"))
          .map((item) => ({
            id: item.id,
            capturedAt: item.capturedAt.toISOString(),
            transcript: item.transcript,
            durationSeconds: item.durationSeconds,
          })),
        timeline: archiveTimeline,
        dispatchTimeline: incident.assignments.flatMap((assignment) => {
          const events: Array<Record<string, unknown>> = [
            { at: assignment.createdAt.toISOString(), label: "Agency assigned", agency: assignment.agency?.name },
          ];
          if (assignment.acceptedAt) events.push({ at: assignment.acceptedAt.toISOString(), label: "Responder accepted" });
          if (assignment.enRouteAt) events.push({ at: assignment.enRouteAt.toISOString(), label: "Responders en route" });
          if (assignment.arrivedAt) events.push({ at: assignment.arrivedAt.toISOString(), label: "On scene" });
          if (assignment.completedAt) events.push({ at: assignment.completedAt.toISOString(), label: "Response completed" });
          return events;
        }),
        communityVerificationSummary: terminalCommunityVerificationSummary,
        verificationStatus: latestVerification?.result ?? "Not verified",
        agency: incident.assignedAgency?.name ?? null,
        responderArrivalAt: arrivalAssignment?.arrivedAt?.toISOString() ?? null,
        resolutionSource: incident.resolutionSource,
        resolutionNotes:
          String(incident.status).toLowerCase().includes("cancel")
            ? incident.cancellationReason
            : incident.resolutionReason,
        finalOutcome: incident.status,
        broadcastReferences: incident.broadcasts,
        nearbyVerificationSummary: terminalCommunityVerificationSummary,
      },
    };
  }

  private toTerminalCommunityVerificationSummary(
    summary: Record<string, unknown>,
    status: string,
  ) {
    const normalized = status.toLowerCase();
    const safeSummaryText = normalized.includes("cancel")
      ? "Community verification ended when this incident was cancelled."
      : normalized.includes("resolve")
        ? "Community verification is complete for this resolved incident."
        : normalized.includes("close")
          ? "Community verification is complete for this closed incident."
          : summary.safeSummaryText;
    return { ...summary, safeSummaryText };
  }

  async getBroadcastArchive(id: string, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, creatorUserId: actor.sub, deletedAt: null },
      include: {
        _count: {
          select: {
            comments: true,
            deliveries: true,
            reads: true,
            sightings: true,
            reports: true,
          },
        },
        comments: {
          where: { hiddenAt: null },
          orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
          take: 20,
          select: {
            id: true,
            body: true,
            isOfficial: true,
            isPinned: true,
            createdAt: true,
          },
        },
      },
    });
    if (!broadcast) throw new NotFoundException("Broadcast archive not found");

    const metadata = (broadcast.metadata ?? {}) as Record<string, unknown>;
    const shareCountRows = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) AS count FROM audit_logs WHERE entity_type = 'broadcasts' AND entity_id = $1::uuid AND action LIKE '%share%'`,
      id,
    );

    return {
      data: {
        archive: true,
        readOnly: true,
        broadcastId: broadcast.id,
        type: broadcast.type,
        kind: classifyBroadcastKind(String(broadcast.type)),
        title: broadcast.title,
        body: broadcast.body,
        createdAt: broadcast.createdAt.toISOString(),
        publishedAt: broadcast.publishedAt?.toISOString() ?? null,
        status: broadcast.status,
        verification: {
          adminVerified: broadcast.adminVerified,
          verifiedAt: broadcast.verifiedAt?.toISOString() ?? null,
        },
        reach: broadcast._count.deliveries,
        views: broadcast._count.reads,
        shares: Number(shareCountRows[0]?.count ?? 0),
        commentsCount: broadcast._count.comments,
        sightingsCount: broadcast._count.sightings,
        reportsCount: broadcast._count.reports,
        comments: broadcast.comments.map((comment) => ({
          id: comment.id,
          body: comment.body,
          isOfficial: comment.isOfficial,
          isPinned: comment.isPinned,
          createdAt: comment.createdAt.toISOString(),
          label: comment.isOfficial ? "Admin comment" : "Comment",
        })),
        adminComments: broadcast.comments
          .filter((comment) => comment.isOfficial)
          .map((comment) => ({
            id: comment.id,
            body: comment.body,
            createdAt: comment.createdAt.toISOString(),
          })),
        resolution: {
          resolvedAt: broadcast.resolvedAt?.toISOString() ?? null,
          status: broadcast.status,
        },
        withdrawalReason: broadcast.suspendedReason ?? metadata.withdrawalReason ?? null,
        withdrawnAt: broadcast.withdrawnAt?.toISOString() ?? null,
        country: broadcast.country,
        missingPerson:
          broadcast.type === BroadcastType.MissingPerson
            ? {
                fullName: metadata.fullName,
                ageOrApproximateAge: metadata.ageOrApproximateAge,
                lastSeenAddress: metadata.lastSeenAddress,
              }
            : null,
        stolenVehicle:
          broadcast.type === BroadcastType.StolenVehicle
            ? {
                make: metadata.make,
                model: metadata.model,
                registrationMasked: metadata.registrationMasked,
                colour: metadata.colour,
              }
            : null,
        timelinePreview: buildBroadcastTimelinePreview(broadcast),
      },
    };
  }

  private async fetchReporterIncidents(userId: string, query: ReturnType<typeof parseActivityHistoryQuery>) {
    const where: Record<string, unknown> = { reporterId: userId };
    if (query.incidentId) where.id = { contains: query.incidentId, mode: "insensitive" };
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.submittedAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }
    if (query.location) {
      where.OR = [
        { address: { contains: query.location, mode: "insensitive" } },
        { manualAddress: { contains: query.location, mode: "insensitive" } },
      ];
    }
    return this.prisma.incident.findMany({
      where: where as never,
      include: {
        assignedAgency: { select: { name: true } },
        verifications: { orderBy: { createdAt: "desc" }, take: 1 },
        media: { where: { deletedAt: null }, orderBy: { uploadedAt: "desc" }, take: 1 },
      },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      take: 250,
    });
  }

  private async fetchCreatorBroadcasts(userId: string, query: ReturnType<typeof parseActivityHistoryQuery>) {
    const where: Record<string, unknown> = { creatorUserId: userId, deletedAt: null };
    if (query.broadcastId) where.id = { contains: query.broadcastId, mode: "insensitive" };
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }
    if (query.missingPersonName) {
      where.metadata = { path: ["fullName"], string_contains: query.missingPersonName };
    }
    if (query.vehiclePlate) {
      where.OR = [
        { metadata: { path: ["registrationNumber"], string_contains: query.vehiclePlate } },
        { metadata: { path: ["registrationMasked"], string_contains: query.vehiclePlate } },
      ];
    }
    return this.prisma.broadcast.findMany({
      where: where as never,
      include: { _count: { select: { deliveries: true, comments: true, reads: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 250,
    });
  }

  private mapIncidentRow(
    incident: Awaited<ReturnType<CitizenActivityService["fetchReporterIncidents"]>>[number],
    unreadByIncident: Map<string, number>,
  ): UnifiedActivityRow {
    const metadata = (incident.metadata ?? {}) as Record<string, unknown>;
    const kind = classifyIncidentKind(String(incident.type), metadata);
    const lifecycle = incidentLifecycleBucket(incident.status as IncidentStatus);
    const latestVerification = incident.verifications[0];
    const confidence = latestVerification?.confidence ? Number(latestVerification.confidence) : undefined;
    return {
      sourceType: "incident",
      kind,
      id: incident.id,
      sortAt: incident.submittedAt,
      lifecycle,
      payload: {
        type: incident.type,
        status: incident.status,
        title: incident.title,
        address: incident.address ?? incident.manualAddress,
        latitude: incident.latitude ?? incident.manualLatitude,
        longitude: incident.longitude ?? incident.manualLongitude,
        agency: incident.assignedAgency?.name ?? null,
        confidence,
        verificationStatus: latestVerification?.result ?? "Pending",
        unreadUpdatesCount: unreadByIncident.get(incident.id) ?? 0,
        thumbnailMediaType: incident.media[0]?.mediaType,
        navigation: resolveIncidentNavigation(incident.status as IncidentStatus),
        isActive: isActiveIncidentStatus(incident.status as IncidentStatus),
        isTerminal: !isActiveIncidentStatus(incident.status as IncidentStatus),
      },
    };
  }

  private mapBroadcastRow(
    broadcast: Awaited<ReturnType<CitizenActivityService["fetchCreatorBroadcasts"]>>[number],
    unreadByBroadcast: Map<string, number>,
  ): UnifiedActivityRow {
    const metadata = (broadcast.metadata ?? {}) as Record<string, unknown>;
    const kind = classifyBroadcastKind(String(broadcast.type));
    const lifecycle = broadcastLifecycleBucket(String(broadcast.status));
    const preview = buildBroadcastTimelinePreview(broadcast);
    const latest = latestTimelinePreviewEntry(preview);
    return {
      sourceType: "broadcast",
      kind,
      id: broadcast.id,
      sortAt: broadcast.publishedAt ?? broadcast.createdAt,
      lifecycle,
      payload: {
        type: broadcast.type,
        status: broadcast.status,
        title: broadcast.title,
        address: metadata.lastSeenAddress ?? metadata.approximateArea ?? null,
        country: broadcast.country,
        verificationStatus: broadcast.adminVerified ? "Verified" : "Pending",
        broadcastReach: broadcast._count.deliveries,
        unreadUpdatesCount: unreadByBroadcast.get(broadcast.id) ?? 0,
        latestUpdate: latest,
        timelinePreview: preview,
        navigation: resolveBroadcastNavigation(String(broadcast.status)),
        isActive: LIVE_BROADCAST_STATUSES.has(String(broadcast.status)),
        isTerminal: !LIVE_BROADCAST_STATUSES.has(String(broadcast.status)),
        missingPersonName: metadata.fullName,
        vehiclePlate: metadata.registrationMasked ?? metadata.registrationNumber,
      },
    };
  }

  private toIncidentActivityItem(item: UnifiedActivityRow, timelinePreview: Array<{ label: string; at: string; type: string }>) {
    const payload = item.payload;
    const sortAt = item.sortAt;
    return {
      sourceType: item.sourceType,
      kind: item.kind,
      id: item.id,
      category: String(payload.type ?? "Incident"),
      status: String(payload.status ?? ""),
      lifecycle: item.lifecycle,
      statusBadge: String(payload.status ?? ""),
      occurredAt: sortAt.toISOString(),
      dateLabel: sortAt.toISOString().slice(0, 10),
      timeLabel: sortAt.toISOString().slice(11, 16),
      location: {
        address: payload.address ?? null,
        latitude: payload.latitude ? Number(payload.latitude) : null,
        longitude: payload.longitude ? Number(payload.longitude) : null,
      },
      agency: payload.agency ?? null,
      verificationConfidence: payload.confidence ?? null,
      verificationStatus: payload.verificationStatus ?? "Pending",
      broadcastReach: null,
      latestUpdate: timelinePreview.length ? latestTimelinePreviewEntry(timelinePreview) : null,
      unreadUpdatesCount: payload.unreadUpdatesCount ?? 0,
      thumbnail: payload.thumbnailMediaType ? { mediaType: payload.thumbnailMediaType } : null,
      timelinePreview,
      navigation: {
        destination: payload.navigation as ActivityNavigationDestination,
        incidentId: item.id,
      },
      isActive: payload.isActive === true,
      isTerminal: payload.isTerminal === true,
      title: payload.title,
    };
  }

  private toBroadcastActivityItem(item: UnifiedActivityRow) {
    const payload = item.payload;
    const sortAt = item.sortAt;
    return {
      sourceType: item.sourceType,
      kind: item.kind,
      id: item.id,
      category: String(payload.type ?? "Broadcast"),
      status: String(payload.status ?? ""),
      lifecycle: item.lifecycle,
      statusBadge: String(payload.status ?? ""),
      occurredAt: sortAt.toISOString(),
      dateLabel: sortAt.toISOString().slice(0, 10),
      timeLabel: sortAt.toISOString().slice(11, 16),
      location: {
        address: payload.address ?? null,
        country: payload.country ?? null,
      },
      agency: null,
      verificationConfidence: null,
      verificationStatus: payload.verificationStatus ?? "Pending",
      broadcastReach: payload.broadcastReach ?? 0,
      latestUpdate: payload.latestUpdate ?? null,
      unreadUpdatesCount: payload.unreadUpdatesCount ?? 0,
      thumbnail: null,
      timelinePreview: payload.timelinePreview ?? [],
      navigation: {
        destination: payload.navigation as ActivityNavigationDestination,
        broadcastId: item.id,
      },
      isActive: payload.isActive === true,
      isTerminal: payload.isTerminal === true,
      title: payload.title,
      missingPersonName: payload.missingPersonName ?? null,
      vehiclePlate: payload.vehiclePlate ?? null,
    };
  }

  private matchesSearch(
    query: ReturnType<typeof parseActivityHistoryQuery>,
    item: UnifiedActivityRow,
  ) {
    if (query.category && item.kind !== query.category && String(item.payload.type) !== query.category) {
      return false;
    }
    const q = query.q?.toLowerCase();
    if (!q) return true;
    const haystack = [
      item.id,
      String(item.payload.title ?? ""),
      String(item.payload.address ?? ""),
      String(item.payload.missingPersonName ?? ""),
      String(item.payload.vehiclePlate ?? ""),
      item.kind,
      String(item.payload.status ?? ""),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  }

  private async unreadCountsByIncident(userId: string) {
    const rows = await this.prisma.notification.groupBy({
      by: ["incidentId"],
      where: { userId, readAt: null, incidentId: { not: null } },
      _count: true,
    });
    return new Map(rows.filter((row) => row.incidentId).map((row) => [row.incidentId!, row._count]));
  }

  private async unreadCountsByBroadcast(userId: string) {
    const rows = await this.prisma.notification.groupBy({
      by: ["broadcastId"],
      where: { userId, readAt: null, broadcastId: { not: null } },
      _count: true,
    });
    return new Map(rows.filter((row) => row.broadcastId).map((row) => [row.broadcastId!, row._count]));
  }

  private async buildIncidentTimelinePreviews(incidentIds: string[]) {
    const map = new Map<string, Array<{ label: string; at: string; type: string }>>();
    await Promise.all(
      incidentIds.map(async (incidentId) => {
        const timeline = await this.incidentTimeline.buildTimeline(incidentId, "citizen");
        const preview = (timeline.data ?? [])
          .slice(-4)
          .map((entry) => ({
            label: String(entry.label ?? entry.type ?? "Update"),
            at: String(entry.at ?? ""),
            type: String(entry.type ?? "update"),
          }));
        map.set(incidentId, preview);
      }),
    );
    return map;
  }

}
