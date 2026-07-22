import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { BroadcastType, IncidentPriority, IncidentType } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import {
  buildCursorPage,
  dateIdCursorWhere,
  decodeDateIdCursor,
  encodeDateIdCursor,
  resolvePageLimit,
  DEFAULT_PAGE_LIMIT,
  type CursorPageQuery,
} from "../../common/pagination/cursor-pagination";
import { BroadcastsService } from "../broadcasts/broadcasts.service";
import { AuditService } from "../audit/audit.service";
import { assertEvidenceObjectKey } from "../../common/storage/s3-presign";
import { IncidentsService } from "../incidents/incidents.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateCommunityDto,
  CreateCommunityPostDto,
  CreateCommunityRequestDto,
  CreatePatrolScheduleDto,
  CreateCommunityCommentDto,
  CreateCommunityContentReportDto,
  CreateCommunityReactionDto,
  AssignCommunityRoleDto,
  ListCommunitiesQuery,
  PatrolCheckpointDto,
  RegisterVolunteerDto,
  ReviewCommunityRequestDto,
  SendCommunityMessageDto,
  UpdateCommunityCommentDto,
  VerifyCommunityPostDto,
  validateCommunity,
  validateCommunityRequest,
  validatePost,
} from "./dto/neighborhood-watch.dto";

@Injectable()
export class NeighborhoodWatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly incidents: IncidentsService,
    private readonly broadcasts: BroadcastsService,
    private readonly notifications: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async listCommunities(actor: JwtPayload, query: ListCommunitiesQuery = {}) {
    const limit = resolvePageLimit(query.limit);
    const cursor = decodeDateIdCursor(query.cursor);
    const where: Record<string, unknown> = { status: "Active" as never };
    if (actor.typ === "admin" && actor.role !== "Super Admin") {
      where.country = actor.country;
      where.state = actor.state;
      where.lga = actor.lga;
    }
    if (query.country) where.country = query.country;
    if (query.state) where.state = query.state;
    if (query.lga) where.lga = query.lga;
    if (query.search?.trim()) {
      where.OR = [
        { name: { contains: query.search.trim(), mode: "insensitive" } },
        { estate: { contains: query.search.trim(), mode: "insensitive" } },
        { ward: { contains: query.search.trim(), mode: "insensitive" } },
      ];
    }
    const rows = await this.prisma.community.findMany({
      where: { ...where, ...dateIdCursorWhere(cursor) } as never,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: actor.typ === "admin"
        ? { memberships: true, posts: { orderBy: { createdAt: "desc" }, take: 20 } }
        : {
            _count: { select: { memberships: { where: { status: "Approved" as never } } } },
            posts: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
          },
    });
    if (actor.typ === "admin") {
      return buildCursorPage(rows, limit, (item) => encodeDateIdCursor(item.createdAt, item.id));
    }
    const page = buildCursorPage(rows, limit, (item) => encodeDateIdCursor(item.createdAt, item.id));
    const membershipMap = actor.typ === "user"
      ? new Map(
          (await this.prisma.communityMembership.findMany({
            where: { userId: actor.sub, communityId: { in: page.data.map((row) => row.id) } },
            select: { communityId: true, status: true },
          })).map((membership) => [membership.communityId, membership.status]),
        )
      : new Map<string, string>();
    const alertTypes = ["SuspiciousActivity", "LostChild", "MissingPerson", "CrimeAlert", "AccidentAlert", "FireAlert", "FloodWarning"];
    const summaries = await Promise.all(page.data.map(async (community) => {
      const activeAlertsCount = await this.prisma.communityPost.count({
        where: {
          communityId: community.id,
          type: { in: alertTypes as never },
          verificationStatus: "Verified" as never,
        },
      });
      return this.toCitizenCommunitySummary(community, membershipMap.get(community.id), activeAlertsCount);
    }));
    return { ...page, data: summaries };
  }

  async createCommunity(dto: CreateCommunityDto, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can create communities");
    validateCommunity(dto);
    await this.assertNoDuplicateCommunity(dto);
    await this.assertAdminJurisdiction(actor, dto.country, dto.state, dto.lga);
    const community = await this.prisma.community.create({
      data: {
        parentId: dto.parentId,
        jurisdictionId: dto.jurisdictionId,
        name: dto.name,
        level: dto.level as never,
        visibility: (dto.visibility ?? "Public") as never,
        country: dto.country,
        state: dto.state,
        lga: dto.lga,
        ward: dto.ward,
        estate: dto.estate,
        street: dto.street,
        description: dto.description,
        createdById: actor.sub,
      } as never,
    });
    await this.writeCommunityLocation(community.id, dto);
    await this.createDefaultRolesAndChannels(community.id);
    await this.audit(actor, "community.created", "communities", community.id, { level: dto.level, visibility: dto.visibility ?? "Public" });
    const detail = await this.getCommunity(community.id, actor);
    return detail;
  }

  async getCommunity(id: string, actor: JwtPayload) {
    await this.assertCommunityVisible(id, actor);
    const community = await this.prisma.community.findUnique({
      where: { id },
      include: {
        children: { select: { id: true, name: true, level: true, visibility: true } },
        roles: { select: { id: true, name: true } },
        channels: { select: { id: true, type: true, name: true } },
        patrolSchedules: actor.typ === "admin"
          ? { include: { checkpoints: true }, take: 20, orderBy: { startsAt: "desc" } }
          : false,
        volunteerProfiles: actor.typ === "admin" ? { take: 50 } : false,
        _count: { select: { memberships: { where: { status: "Approved" as never } } } },
        posts: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    });
    if (!community) throw new NotFoundException("Community not found");
    if (community.status !== "Active") throw new ForbiddenException("Community is not active");
    const membership = actor.typ === "user"
      ? await this.prisma.communityMembership.findUnique({ where: { communityId_userId: { communityId: id, userId: actor.sub } } })
      : null;
    const activeAlertsCount = await this.prisma.communityPost.count({
      where: {
        communityId: id,
        type: { in: ["SuspiciousActivity", "LostChild", "MissingPerson", "CrimeAlert", "AccidentAlert", "FireAlert", "FloodWarning"] as never },
        verificationStatus: "Verified" as never,
      },
    });
    if (actor.typ === "admin") return { data: community };
    return {
      data: this.toCitizenCommunitySummary(community, membership?.status, activeAlertsCount, {
        description: community.description,
        channels: community.channels,
        roles: undefined,
      }),
    };
  }

  async joinCommunity(communityId: string, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can join communities");
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException("Community not found");
    if (community.status !== "Active") throw new ForbiddenException("Community is not accepting members");
    await this.assertUserEligible(actor.sub);
    const residentRole = await this.prisma.communityRole.findFirst({ where: { communityId, name: "Resident" as never } });
    const existing = await this.prisma.communityMembership.findUnique({ where: { communityId_userId: { communityId, userId: actor.sub } } });
    if (existing?.status === "Approved") return { data: existing };
    const status = community.visibility === "Private" ? "Pending" : "Approved";
    const membership = await this.prisma.communityMembership.upsert({
      where: { communityId_userId: { communityId, userId: actor.sub } },
      update: { status: status as never, leftAt: null, requestedAt: new Date() },
      create: { communityId, userId: actor.sub, roleId: residentRole?.id, status: status as never } as never,
    });
    await this.audit(actor, status === "Pending" ? "community.join_requested" : "community.joined", "communities", communityId, { membershipId: membership.id });
    if (status === "Pending") await this.notifyModerators(communityId, "Join request", "A resident requested to join your community", { communityId, membershipId: membership.id });
    return { data: membership };
  }

  async rejectMember(communityId: string, membershipId: string, actor: JwtPayload, note?: string) {
    await this.assertModerator(communityId, actor);
    const membership = await this.prisma.communityMembership.findUnique({ where: { id: membershipId } });
    if (!membership || membership.communityId !== communityId) throw new NotFoundException("Membership not found");
    const updated = await this.prisma.communityMembership.update({
      where: { id: membershipId },
      data: { status: "Rejected" as never } as never,
    });
    await this.audit(actor, "community.member_rejected", "community_memberships", membership.id, { communityId, note });
    await this.notifyUser(membership.userId, "Join request declined", note ?? "Your community join request was declined", { communityId });
    return { data: updated };
  }

  async listMembers(communityId: string, actor: JwtPayload, query: CursorPageQuery = {}) {
    await this.assertCommunityVisible(communityId, actor);
    const limit = resolvePageLimit(query.limit);
    const cursor = decodeDateIdCursor(query.cursor);
    const rows = await this.prisma.communityMembership.findMany({
      where: { communityId, status: "Approved" as never, ...dateIdCursorWhere(cursor) } as never,
      include: {
        role: { select: { name: true } },
        user: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: [{ approvedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = buildCursorPage(rows, limit, (item) => encodeDateIdCursor(item.approvedAt ?? item.requestedAt, item.id));
    return {
      ...page,
      data: page.data.map((membership) => ({
        id: membership.id,
        userId: membership.userId,
        displayName: [membership.user.profile?.firstName, membership.user.profile?.lastName].filter(Boolean).join(" ") || "Member",
        role: membership.role?.name ?? "Resident",
        approvedAt: membership.approvedAt,
      })),
    };
  }

  async approveMember(communityId: string, membershipId: string, actor: JwtPayload) {
    await this.assertModerator(communityId, actor);
    const membership = await this.prisma.communityMembership.update({
      where: { id: membershipId },
      data: { status: "Approved" as never, approvedById: actor.sub, approvedAt: new Date() } as never,
    });
    await this.audit(actor, "community.member_approved", "community_memberships", membership.id, { communityId });
    await this.notifyUser(membership.userId, "Join request approved", "You can now participate in your community", { communityId });
    return { data: membership };
  }

  async leaveCommunity(communityId: string, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can leave communities");
    const membership = await this.prisma.communityMembership.findUnique({
      where: { communityId_userId: { communityId, userId: actor.sub } },
      include: { role: true },
    });
    if (!membership || membership.status !== "Approved") throw new NotFoundException("Membership not found");
    if (["CommunityModerator", "EstateAdmin"].includes(String(membership.role?.name))) {
      throw new BadRequestException("Transfer community ownership before leaving moderator role");
    }
    const updated = await this.prisma.communityMembership.update({
      where: { communityId_userId: { communityId, userId: actor.sub } },
      data: { status: "Left" as never, leftAt: new Date() } as never,
    });
    await this.audit(actor, "community.left", "communities", communityId, { membershipId: updated.id });
    return { data: updated };
  }

  async createPost(communityId: string, dto: CreateCommunityPostDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can create community posts");
    validatePost(dto);
    await this.assertApprovedMember(communityId, actor.sub);
    if (dto.media?.length) {
      for (const media of dto.media) {
        assertEvidenceObjectKey(`community-${communityId}`, media.objectKey, media.bucket, media.contentType);
      }
    }
    const post = await this.prisma.communityPost.create({
      data: {
        communityId,
        authorId: actor.sub,
        type: dto.type as never,
        title: dto.title,
        body: dto.body,
        latitude: dto.latitude,
        longitude: dto.longitude,
        media: dto.media?.length
          ? {
              create: dto.media.map((media) => ({
                uploaderId: actor.sub,
                mediaType: media.mediaType as never,
                bucket: media.bucket,
                objectKey: media.objectKey,
                contentType: media.contentType,
                fileHash: media.fileHash,
              })),
            }
          : undefined,
      } as never,
    });
    if (dto.latitude !== undefined && dto.longitude !== undefined) await this.writePostLocation(post.id, dto.latitude, dto.longitude);
    const scored = await this.scorePost(post.id, actor.sub, false);
    await this.notifyCommunity(communityId, post.id, scored.title, this.notificationBody(scored.type as string));
    await this.audit(actor, "community.post_created", "community_posts", post.id, { communityId, type: dto.type });
    return { data: scored };
  }

  async listPosts(actor: JwtPayload, query: CursorPageQuery = {}) {
    const communityWhere =
      actor.typ === "admin" && actor.role !== "Super Admin"
        ? { country: actor.country, state: actor.state, lga: actor.lga }
        : {};
    const limit = resolvePageLimit(query.limit);
    const cursor = decodeDateIdCursor(query.cursor);
    const rows = await this.prisma.communityPost.findMany({
      where: {
        ...(Object.keys(communityWhere).length ? { community: communityWhere } : {}),
        ...dateIdCursorWhere(cursor),
      } as never,
      include: { community: true, media: true, comments: true, reactions: true, verifications: true, incident: true, broadcast: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    return buildCursorPage(rows, limit, (item) => encodeDateIdCursor(item.createdAt, item.id));
  }

  async feed(communityId: string, actor: JwtPayload, query: CursorPageQuery = {}) {
    await this.assertCommunityVisible(communityId, actor);
    const limit = resolvePageLimit(query.limit);
    const cursor = decodeDateIdCursor(query.cursor);
    const rows = await this.prisma.communityPost.findMany({
      where: { communityId, ...dateIdCursorWhere(cursor) },
      include: { media: true, comments: true, reactions: true, verifications: true, incident: true, broadcast: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    return buildCursorPage(rows, limit, (item) => encodeDateIdCursor(item.createdAt, item.id));
  }

  async verifyPost(postId: string, dto: VerifyCommunityPostDto, actor: JwtPayload) {
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException("Community post not found");
    await this.assertModerator(post.communityId, actor);
    const scored = await this.scorePost(postId, post.authorId, dto.moderatorConfirmed ?? true);
    const confidence = dto.status === "Verified" ? Math.max(Number(scored.confidenceScore), 75) : Number(scored.confidenceScore);
    await this.prisma.communityVerification.create({
      data: { postId, verifierId: actor.typ === "user" ? actor.sub : undefined, status: dto.status as never, confidence, note: dto.note, signals: { moderatorConfirmed: dto.moderatorConfirmed ?? true } } as never,
    });
    const updated = await this.prisma.communityPost.update({
      where: { id: postId },
      data: { verificationStatus: dto.status as never, confidenceScore: confidence } as never,
    });
    await this.audit(actor, "community.post_verified", "community_posts", postId, { status: dto.status, confidence });
    return { data: updated };
  }

  async convertPostToIncident(postId: string, actor: JwtPayload) {
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId }, include: { community: true } });
    if (!post) throw new NotFoundException("Community post not found");
    await this.assertModerator(post.communityId, actor);
    if (!Number.isFinite(Number(post.latitude)) || !Number.isFinite(Number(post.longitude))) {
      throw new BadRequestException("Post location is required before converting to incident");
    }
    const incidentType = this.incidentTypeFromPost(post.type as string);
    const incident = await this.incidents.report({
      type: incidentType,
      title: post.title,
      description: post.body,
      latitude: Number(post.latitude),
      longitude: Number(post.longitude),
      priority: incidentType === IncidentType.Emergency ? IncidentPriority.P1LifeThreatening : IncidentPriority.P3SuspiciousActivity,
      anonymous: false,
    }, actor);
    const incidentData = ("data" in incident ? incident.data : incident) as { id: string };
    await this.prisma.communityPost.update({ where: { id: postId }, data: { incidentId: incidentData.id, isEscalated: true } as never });
    await this.audit(actor, "community.post_converted_to_incident", "community_posts", postId, { incidentId: incidentData.id });
    return { data: incidentData };
  }

  async broadcastVerifiedPost(postId: string, scope: "Neighborhood" | "LGA" | "State" | "Emergency", actor: JwtPayload) {
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId }, include: { community: true } });
    if (!post) throw new NotFoundException("Community post not found");
    await this.assertModerator(post.communityId, actor);
    if (post.verificationStatus !== "Verified") throw new BadRequestException("Only verified community posts can become broadcasts");
    const result = await this.broadcasts.create({
      type: scope === "Emergency" ? BroadcastType.Emergency : BroadcastType.CommunityWarning,
      title: post.title,
      body: post.body,
      priority: scope === "Emergency" ? IncidentPriority.P1LifeThreatening : IncidentPriority.P3SuspiciousActivity,
      jurisdictionId: post.community.jurisdictionId ?? undefined,
      latitude: post.latitude ? Number(post.latitude) : undefined,
      longitude: post.longitude ? Number(post.longitude) : undefined,
      radiusMeters: scope === "State" ? 50000 : scope === "LGA" ? 15000 : 3000,
      requiresApproval: scope !== "Emergency",
    }, actor);
    await this.prisma.communityPost.update({ where: { id: postId }, data: { broadcastId: result.data.id } as never });
    await this.audit(actor, "community.post_shared_to_broadcast", "community_posts", postId, { broadcastId: result.data.id, scope });
    return result;
  }

  async map(communityId: string, actor: JwtPayload) {
    await this.assertCommunityVisible(communityId, actor);
    const [posts, policeStations, volunteers, patrols] = await Promise.all([
      this.prisma.communityPost.findMany({ where: { communityId }, take: DEFAULT_PAGE_LIMIT, orderBy: { createdAt: "desc" } }),
      this.prisma.policeStation.findMany({ take: 50 }),
      this.prisma.volunteerProfile.findMany({ where: { communityId, available: true }, take: 50 }),
      this.prisma.patrolSchedule.findMany({ where: { communityId }, include: { checkpoints: true }, take: 20 }),
    ]);
    return { data: { posts, policeStations, volunteers, patrols, safePoints: [], hospitals: [], dangerZones: [] } };
  }

  async registerVolunteer(dto: RegisterVolunteerDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can register as volunteers");
    const profile = await this.prisma.volunteerProfile.upsert({
      where: { userId: actor.sub },
      update: { communityId: dto.communityId, types: dto.types as never, latitude: dto.latitude, longitude: dto.longitude },
      create: { userId: actor.sub, communityId: dto.communityId, types: dto.types as never, latitude: dto.latitude, longitude: dto.longitude } as never,
    });
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      await this.prisma.$executeRawUnsafe(`UPDATE volunteer_profiles SET gps_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE id = $3::uuid`, dto.longitude, dto.latitude, profile.id);
    }
    await this.audit(actor, "community.volunteer_registered", "volunteer_profiles", profile.id, { types: dto.types });
    return { data: profile };
  }

  async createPatrol(communityId: string, dto: CreatePatrolScheduleDto, actor: JwtPayload) {
    await this.assertModerator(communityId, actor);
    const schedule = await this.prisma.patrolSchedule.create({
      data: { communityId, title: dto.title, startsAt: new Date(dto.startsAt), endsAt: new Date(dto.endsAt), createdById: actor.sub } as never,
    });
    await this.audit(actor, "community.patrol_created", "patrol_schedules", schedule.id, { communityId });
    return { data: schedule };
  }

  async logCheckpoint(scheduleId: string, dto: PatrolCheckpointDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only volunteers can log patrol checkpoints");
    const checkpoint = await (this.prisma as any).patrolCheckpoint.create({
      data: { scheduleId, submittedById: actor.sub, label: dto.label, latitude: dto.latitude, longitude: dto.longitude, gpsLocation: undefined } as never,
    });
    await this.prisma.$executeRawUnsafe(`UPDATE patrol_checkpoints SET gps_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE id = $3::uuid`, dto.longitude, dto.latitude, checkpoint.id);
    await this.audit(actor, "community.patrol_checkpoint_logged", "patrol_checkpoints", checkpoint.id, { scheduleId });
    return { data: checkpoint };
  }

  async channelMessages(channelId: string, actor: JwtPayload) {
    const channel = await this.prisma.communityChannel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException("Community channel not found");
    await this.assertCommunityVisible(channel.communityId, actor);
    return {
      data: await this.prisma.communityMessage.findMany({ where: { channelId }, orderBy: { createdAt: "asc" }, take: 100 }),
      realtime: { transport: "websocket-ready", room: `community-channel:${channelId}` },
    };
  }

  async sendMessage(channelId: string, dto: SendCommunityMessageDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can send community messages");
    if (!dto.body?.trim()) throw new BadRequestException("Message body is required");
    const channel = await this.prisma.communityChannel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException("Community channel not found");
    await this.assertApprovedMember(channel.communityId, actor.sub);
    const message = await this.prisma.communityMessage.create({ data: { channelId, senderId: actor.sub, body: dto.body.trim() } as never });
    await this.audit(actor, "community.message_sent", "community_messages", message.id, { channelId, communityId: channel.communityId });
    return { data: message, realtime: { event: "community.message.created", room: `community-channel:${channelId}` } };
  }

  async createCommunityRequest(dto: CreateCommunityRequestDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can request communities");
    validateCommunityRequest(dto);
    const profile = await this.prisma.profile.findUnique({ where: { userId: actor.sub } });
    if (!profile?.country) throw new BadRequestException("Complete your profile jurisdiction before requesting a community");
    if (dto.country !== profile.country || (profile.state && dto.state && dto.state !== profile.state) || (profile.lga && dto.lga && dto.lga !== profile.lga)) {
      throw new ForbiddenException("Community request must match your verified jurisdiction");
    }
    await this.assertNoDuplicateCommunity(dto);
    const request = await this.prisma.communityRequest.create({
      data: {
        requesterId: actor.sub,
        name: dto.name.trim(),
        description: dto.description,
        country: dto.country,
        state: dto.state,
        lga: dto.lga,
        ward: dto.ward,
        estate: dto.estate,
        street: dto.street,
        visibility: (dto.visibility ?? "Private") as never,
        latitude: dto.latitude,
        longitude: dto.longitude,
      } as never,
    });
    await this.audit(actor, "community.request_created", "community_requests", request.id, { name: dto.name });
    return { data: request };
  }

  async listCommunityRequests(actor: JwtPayload) {
    const where = actor.typ === "admin" && actor.role !== "Super Admin"
      ? { country: actor.country, state: actor.state, lga: actor.lga, status: "Pending" as never }
      : actor.typ === "admin"
        ? { status: "Pending" as never }
        : { requesterId: actor.sub };
    return { data: await this.prisma.communityRequest.findMany({ where: where as never, orderBy: { createdAt: "desc" }, take: 100 }) };
  }

  async reviewCommunityRequest(requestId: string, dto: ReviewCommunityRequestDto, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can review community requests");
    const request = await this.prisma.communityRequest.findUnique({ where: { id: requestId } });
    if (!request || request.status !== "Pending") throw new NotFoundException("Community request not found");
    await this.assertAdminJurisdiction(actor, request.country, request.state ?? undefined, request.lga ?? undefined);
    if (dto.action === "reject") {
      const rejected = await this.prisma.communityRequest.update({
        where: { id: requestId },
        data: { status: "Rejected" as never, reviewedById: actor.sub, reviewedAt: new Date(), rejectionNote: dto.rejectionNote } as never,
      });
      await this.audit(actor, "community.request_rejected", "community_requests", requestId, { note: dto.rejectionNote });
      await this.notifyUser(request.requesterId, "Community request declined", dto.rejectionNote ?? "Your community request was declined", {});
      return { data: rejected };
    }
    const community = await this.createCommunity({
      name: request.name,
      level: "Community",
      visibility: request.visibility as "Public" | "Private",
      country: request.country,
      state: request.state ?? undefined,
      lga: request.lga ?? undefined,
      ward: request.ward ?? undefined,
      estate: request.estate ?? undefined,
      street: request.street ?? undefined,
      description: request.description ?? undefined,
      latitude: request.latitude ? Number(request.latitude) : undefined,
      longitude: request.longitude ? Number(request.longitude) : undefined,
    }, actor);
    const approved = await this.prisma.communityRequest.update({
      where: { id: requestId },
      data: {
        status: "Approved" as never,
        reviewedById: actor.sub,
        reviewedAt: new Date(),
        communityId: (community.data as { id: string }).id,
      } as never,
    });
    await this.audit(actor, "community.request_approved", "community_requests", requestId, { communityId: approved.communityId });
    await this.notifyUser(request.requesterId, "Community request approved", "Your requested community is now available", { communityId: approved.communityId });
    return { data: approved, community: community.data };
  }

  async listPostComments(postId: string, actor: JwtPayload, query: CursorPageQuery = {}) {
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException("Community post not found");
    await this.assertCommunityVisible(post.communityId, actor);
    const limit = resolvePageLimit(query.limit);
    const cursor = decodeDateIdCursor(query.cursor);
    const rows = await this.prisma.communityPostComment.findMany({
      where: { postId, ...dateIdCursorWhere(cursor) },
      include: { author: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit + 1,
    });
    const page = buildCursorPage(rows, limit, (item) => encodeDateIdCursor(item.createdAt, item.id));
    return {
      ...page,
      data: page.data.map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        author: {
          id: comment.author.id,
          displayName: [comment.author.profile?.firstName, comment.author.profile?.lastName].filter(Boolean).join(" ") || "Member",
        },
      })),
    };
  }

  async createPostComment(postId: string, dto: CreateCommunityCommentDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can comment");
    if (!dto.body?.trim()) throw new BadRequestException("Comment body is required");
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException("Community post not found");
    await this.assertApprovedMember(post.communityId, actor.sub);
    const comment = await this.prisma.communityPostComment.create({
      data: { postId, authorId: actor.sub, body: dto.body.trim() },
    });
    await this.audit(actor, "community.comment_created", "community_post_comments", comment.id, { postId });
    if (post.authorId !== actor.sub) {
      await this.notifyUser(post.authorId, "New comment on your post", dto.body.trim().slice(0, 120), { postId, communityId: post.communityId });
    }
    return { data: comment };
  }

  async updatePostComment(commentId: string, dto: UpdateCommunityCommentDto, actor: JwtPayload) {
    const comment = await this.prisma.communityPostComment.findUnique({ where: { id: commentId }, include: { post: true } });
    if (!comment) throw new NotFoundException("Comment not found");
    if (comment.authorId !== actor.sub) throw new ForbiddenException("Only the author can edit this comment");
    const updated = await this.prisma.communityPostComment.update({ where: { id: commentId }, data: { body: dto.body.trim() } });
    await this.audit(actor, "community.comment_updated", "community_post_comments", commentId, { postId: comment.postId });
    return { data: updated };
  }

  async deletePostComment(commentId: string, actor: JwtPayload) {
    const comment = await this.prisma.communityPostComment.findUnique({ where: { id: commentId }, include: { post: true } });
    if (!comment) throw new NotFoundException("Comment not found");
    if (comment.authorId !== actor.sub) await this.assertModerator(comment.post.communityId, actor);
    await this.prisma.communityPostComment.delete({ where: { id: commentId } });
    await this.audit(actor, "community.comment_deleted", "community_post_comments", commentId, { postId: comment.postId });
    return { data: { id: commentId, deleted: true } };
  }

  async createPostReaction(postId: string, dto: CreateCommunityReactionDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can react");
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException("Community post not found");
    await this.assertApprovedMember(post.communityId, actor.sub);
    const reaction = await this.prisma.communityPostReaction.upsert({
      where: { postId_userId_type: { postId, userId: actor.sub, type: dto.type as never } },
      update: {},
      create: { postId, userId: actor.sub, type: dto.type as never },
    });
    await this.audit(actor, "community.reaction_created", "community_post_reactions", reaction.id, { postId, type: dto.type });
    return { data: reaction };
  }

  async deletePostReaction(postId: string, type: CreateCommunityReactionDto["type"], actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can remove reactions");
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException("Community post not found");
    await this.assertApprovedMember(post.communityId, actor.sub);
    await this.prisma.communityPostReaction.deleteMany({ where: { postId, userId: actor.sub, type: type as never } });
    await this.audit(actor, "community.reaction_deleted", "community_post_reactions", postId, { type });
    return { data: { postId, type, deleted: true } };
  }

  async createContentReport(communityId: string, dto: CreateCommunityContentReportDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can submit reports");
    await this.assertApprovedMember(communityId, actor.sub);
    const report = await this.prisma.communityContentReport.create({
      data: {
        communityId,
        reporterId: actor.sub,
        targetType: dto.targetType as never,
        targetId: dto.targetId,
        reasonCode: dto.reasonCode,
        note: dto.note,
      } as never,
    });
    await this.audit(actor, "community.content_reported", "community_content_reports", report.id, { targetType: dto.targetType, targetId: dto.targetId });
    await this.notifyModerators(communityId, "New moderation report", `Report submitted for ${dto.targetType}`, { reportId: report.id });
    return { data: report };
  }

  async listContentReports(actor: JwtPayload, communityId?: string) {
    const where: Record<string, unknown> = { status: "Pending" as never };
    if (communityId) where.communityId = communityId;
    if (actor.typ === "admin" && actor.role !== "Super Admin") {
      where.community = { country: actor.country, state: actor.state, lga: actor.lga };
    }
    return { data: await this.prisma.communityContentReport.findMany({ where: where as never, orderBy: { createdAt: "desc" }, take: 100 }) };
  }

  async assignMemberRole(communityId: string, membershipId: string, dto: AssignCommunityRoleDto, actor: JwtPayload) {
    await this.assertModerator(communityId, actor);
    const role = await this.prisma.communityRole.findFirst({ where: { communityId, name: dto.roleName as never } });
    if (!role) throw new NotFoundException("Community role not found");
    const membership = await this.prisma.communityMembership.update({
      where: { id: membershipId },
      data: { roleId: role.id },
    });
    await this.audit(actor, "community.role_assigned", "community_memberships", membership.id, { communityId, roleName: dto.roleName });
    return { data: membership };
  }

  async listPatrols(communityId: string, actor: JwtPayload) {
    await this.assertCommunityVisible(communityId, actor);
    return {
      data: await this.prisma.patrolSchedule.findMany({
        where: { communityId },
        include: { checkpoints: true, assignments: { include: { user: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } } } } },
        orderBy: { startsAt: "desc" },
        take: 50,
      }),
    };
  }

  async listAlerts(communityId: string, actor: JwtPayload, query: CursorPageQuery = {}) {
    await this.assertCommunityVisible(communityId, actor);
    const limit = resolvePageLimit(query.limit);
    const cursor = decodeDateIdCursor(query.cursor);
    const alertTypes = ["SuspiciousActivity", "LostChild", "MissingPerson", "CrimeAlert", "AccidentAlert", "FireAlert", "FloodWarning"];
    const rows = await this.prisma.communityPost.findMany({
      where: {
        communityId,
        type: { in: alertTypes as never },
        verificationStatus: { in: ["Verified", "PendingVerification"] as never },
        ...dateIdCursorWhere(cursor),
      } as never,
      include: { media: true, author: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    return buildCursorPage(rows, limit, (item) => encodeDateIdCursor(item.createdAt, item.id));
  }

  async getPost(postId: string, actor: JwtPayload) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
      include: {
        media: true,
        comments: { orderBy: { createdAt: "asc" }, take: 20 },
        reactions: true,
        author: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!post) throw new NotFoundException("Community post not found");
    await this.assertCommunityVisible(post.communityId, actor);
    return { data: post };
  }

  private async scorePost(postId: string, reporterId: string, moderatorConfirmed: boolean) {
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId }, include: { media: true, reactions: true, incident: true } });
    if (!post) throw new NotFoundException("Community post not found");
    const trusted = await this.prisma.trustedReporter.findUnique({ where: { userId: reporterId } });
    const score = Math.min(100,
      (trusted ? Number(trusted.trustScore) * 0.25 : 10) +
      (post.latitude && post.longitude ? 15 : 0) +
      (post.media.length ? 20 : 0) +
      (post.reactions.filter((reaction) => reaction.type === "Confirm").length * 8) +
      (moderatorConfirmed ? 25 : 0) +
      (post.incidentId ? 15 : 0));
    return this.prisma.communityPost.update({ where: { id: postId }, data: { confidenceScore: score } as never });
  }

  private async assertCommunityVisible(communityId: string, actor: JwtPayload) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException("Community not found");
    if (community.status !== "Active") throw new ForbiddenException("Community is not active");
    if (community.visibility === "Public" || actor.typ === "admin") return;
    await this.assertApprovedMember(communityId, actor.sub);
  }

  private async assertApprovedMember(communityId: string, userId: string) {
    const membership = await this.prisma.communityMembership.findUnique({ where: { communityId_userId: { communityId, userId } } });
    if (!membership || membership.status !== "Approved") throw new ForbiddenException("Approved community membership is required");
  }

  private async assertModerator(communityId: string, actor: JwtPayload) {
    if (actor.typ === "admin") return;
    const membership = await this.prisma.communityMembership.findUnique({ where: { communityId_userId: { communityId, userId: actor.sub } }, include: { role: true } });
    const allowed = ["CommunityModerator", "EstateAdmin", "SecurityCoordinator", "PoliceLiaison", "VolunteerCoordinator"];
    if (!membership || membership.status !== "Approved" || !membership.role || !allowed.includes(membership.role.name as string)) {
      throw new ForbiddenException("Community moderator permissions are required");
    }
  }

  private async writeCommunityLocation(id: string, dto: CreateCommunityDto) {
    if (dto.boundaryWkt) {
      await this.prisma.$executeRawUnsafe(`UPDATE communities SET boundary = ST_Multi(ST_GeomFromText($1, 4326))::geography WHERE id = $2::uuid`, dto.boundaryWkt, id);
    }
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      await this.prisma.$executeRawUnsafe(`UPDATE communities SET center = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE id = $3::uuid`, dto.longitude, dto.latitude, id);
    }
  }

  private async writePostLocation(postId: string, latitude: number, longitude: number) {
    await this.prisma.$executeRawUnsafe(`UPDATE community_posts SET gps_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE id = $3::uuid`, longitude, latitude, postId);
  }

  private async createDefaultRolesAndChannels(communityId: string) {
    const roles = ["CommunityModerator", "EstateAdmin", "SecurityCoordinator", "PoliceLiaison", "VolunteerCoordinator", "VerifiedVolunteer", "Resident"];
    const channels = ["General", "Emergency", "Security", "Volunteers", "WomenSafety", "Parents", "BusinessOwners"];
    await this.prisma.communityRole.createMany({ data: roles.map((name) => ({ communityId, name: name as never, permissions: this.rolePermissions(name) })), skipDuplicates: true });
    await this.prisma.communityChannel.createMany({ data: channels.map((type) => ({ communityId, type: type as never, name: this.channelName(type) })), skipDuplicates: true });
  }

  private rolePermissions(name: string) {
    if (["CommunityModerator", "EstateAdmin"].includes(name)) return ["community:moderate", "community:verify", "community:patrol"];
    if (name === "VolunteerCoordinator") return ["community:volunteer", "community:patrol"];
    if (name === "VerifiedVolunteer") return ["community:volunteer"];
    return ["community:read", "community:post"];
  }

  private channelName(type: string) {
    return type.replace(/([A-Z])/g, " $1").trim();
  }

  private toCitizenCommunitySummary(
    community: {
      id: string;
      name: string;
      country: string;
      state: string | null;
      lga: string | null;
      ward: string | null;
      estate: string | null;
      street: string | null;
      visibility: string;
      status?: string;
      description?: string | null;
      channels?: Array<{ id: string; type: string; name: string }>;
      posts?: Array<{ createdAt: Date }>;
      _count?: { memberships: number };
    },
    membershipStatus?: string,
    activeAlertsCount = 0,
    extra?: { description?: string | null; channels?: Array<{ id: string; type: string; name: string }> },
  ) {
    return {
      id: community.id,
      name: community.name,
      description: extra?.description ?? community.description ?? null,
      country: community.country,
      state: community.state,
      lga: community.lga,
      ward: community.ward,
      estate: community.estate,
      street: community.street,
      visibility: community.visibility,
      status: community.status ?? "Active",
      memberCount: community._count?.memberships ?? 0,
      activeAlertsCount,
      latestActivityAt: community.posts?.[0]?.createdAt ?? null,
      membershipStatus: membershipStatus ?? null,
      channels: extra?.channels ?? community.channels,
    };
  }

  private async assertNoDuplicateCommunity(dto: Pick<CreateCommunityDto, "name" | "country" | "state" | "lga" | "ward" | "estate" | "street">) {
    const duplicate = await this.prisma.community.findFirst({
      where: {
        status: "Active" as never,
        name: { equals: dto.name.trim(), mode: "insensitive" },
        country: dto.country,
        state: dto.state ?? null,
        lga: dto.lga ?? null,
        ward: dto.ward ?? null,
        estate: dto.estate ?? null,
        street: dto.street ?? null,
      } as never,
    });
    if (duplicate) throw new BadRequestException("A community with this name already exists in the selected area");
  }

  private async assertAdminJurisdiction(actor: JwtPayload, country: string, state?: string, lga?: string) {
    if (actor.typ !== "admin" || actor.role === "Super Admin") return;
    if (actor.country && actor.country !== country) throw new ForbiddenException("Community is outside your jurisdiction");
    if (actor.state && state && actor.state !== state) throw new ForbiddenException("Community is outside your jurisdiction");
    if (actor.lga && lga && actor.lga !== lga) throw new ForbiddenException("Community is outside your jurisdiction");
  }

  private async assertUserEligible(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (!user || user.status !== "Active") throw new ForbiddenException("Account is not eligible to join communities");
    const suspended = await this.prisma.communityMembership.findFirst({ where: { userId, status: "Suspended" as never } });
    if (suspended) throw new ForbiddenException("Community membership is suspended");
  }

  private async notifyModerators(communityId: string, title: string, body: string, metadata: Record<string, unknown>) {
    const moderators = await this.prisma.communityMembership.findMany({
      where: {
        communityId,
        status: "Approved" as never,
        role: { name: { in: ["CommunityModerator", "EstateAdmin", "SecurityCoordinator"] as never } },
      },
      take: 25,
    });
    for (const moderator of moderators) {
      const notification = await this.prisma.notification.create({
        data: { userId: moderator.userId, communityId, channel: "push", title, body, status: "Pending" as never, provider: "fcm" } as never,
      });
      await this.notifications.enqueue({ userId: moderator.userId, notificationId: notification.id, communityId, title, body, ...metadata });
    }
  }

  private async notifyUser(userId: string, title: string, body: string, metadata: Record<string, unknown>) {
    const notification = await this.prisma.notification.create({
      data: { userId, channel: "push", title, body, status: "Pending" as never, provider: "fcm" } as never,
    });
    await this.notifications.enqueue({ userId, notificationId: notification.id, title, body, ...metadata });
  }

  private incidentTypeFromPost(type: string): IncidentType {
    if (type === "Emergency" || type === "EmergencyAlert") return IncidentType.Emergency;
    if (type === "CrimeAlert" || type === "SuspiciousActivity") return IncidentType.Crime;
    if (type === "AccidentAlert") return IncidentType.Accident;
    if (type === "FireAlert") return IncidentType.Fire;
    if (type === "MissingPerson" || type === "LostChild") return IncidentType.MissingPerson;
    return IncidentType.CommunitySafety;
  }

  private notificationBody(type: string) {
    if (type === "LostChild") return "Missing child nearby";
    if (type === "SuspiciousActivity") return "Nearby suspicious activity";
    if (type === "SecurityMeeting") return "Security meeting reminder";
    if (type === "PatrolUpdate") return "Patrol request";
    return "Community safety alert";
  }

  private async notifyCommunity(communityId: string, postId: string, title: string, body: string) {
    const members = await this.prisma.communityMembership.findMany({ where: { communityId, status: "Approved" as never }, take: 500 });
    for (const member of members) {
      const notification = await this.prisma.notification.create({
        data: { userId: member.userId, communityId, channel: "push", title, body, status: "Pending" as never, provider: "fcm" } as never,
      });
      await this.notifications.enqueue({ userId: member.userId, notificationId: notification.id, communityId, postId, title, body });
    }
  }

  private audit(actor: JwtPayload, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>) {
    return this.auditService.record({
      actor,
      action,
      entityType,
      entityId,
      metadata,
    });
  }
}
