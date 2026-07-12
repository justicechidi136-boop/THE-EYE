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
  CreatePatrolScheduleDto,
  PatrolCheckpointDto,
  RegisterVolunteerDto,
  SendCommunityMessageDto,
  VerifyCommunityPostDto,
  validateCommunity,
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

  async listCommunities(actor: JwtPayload) {
    const where = actor.typ === "admin" && actor.role !== "Super Admin"
      ? { country: actor.country, state: actor.state, lga: actor.lga }
      : {};
    return { data: await this.prisma.community.findMany({ where: where as never, include: { memberships: true, posts: true }, orderBy: { createdAt: "desc" }, take: 100 }) };
  }

  async createCommunity(dto: CreateCommunityDto, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can create communities");
    validateCommunity(dto);
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
    return { data: await this.getCommunity(community.id, actor) };
  }

  async getCommunity(id: string, actor: JwtPayload) {
    await this.assertCommunityVisible(id, actor);
    const community = await this.prisma.community.findUnique({
      where: { id },
      include: { children: true, roles: true, memberships: true, channels: true, patrolSchedules: true, volunteerProfiles: true },
    });
    if (!community) throw new NotFoundException("Community not found");
    return community;
  }

  async joinCommunity(communityId: string, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can join communities");
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException("Community not found");
    const residentRole = await this.prisma.communityRole.findFirst({ where: { communityId, name: "Resident" as never } });
    const status = community.visibility === "Private" ? "Pending" : "Approved";
    const membership = await this.prisma.communityMembership.upsert({
      where: { communityId_userId: { communityId, userId: actor.sub } },
      update: { status: status as never, leftAt: null },
      create: { communityId, userId: actor.sub, roleId: residentRole?.id, status: status as never } as never,
    });
    await this.audit(actor, status === "Pending" ? "community.join_requested" : "community.joined", "communities", communityId, { membershipId: membership.id });
    return { data: membership };
  }

  async approveMember(communityId: string, membershipId: string, actor: JwtPayload) {
    await this.assertModerator(communityId, actor);
    const membership = await this.prisma.communityMembership.update({
      where: { id: membershipId },
      data: { status: "Approved" as never, approvedById: actor.sub, approvedAt: new Date() } as never,
    });
    await this.audit(actor, "community.member_approved", "community_memberships", membership.id, { communityId });
    return { data: membership };
  }

  async leaveCommunity(communityId: string, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can leave communities");
    const membership = await this.prisma.communityMembership.update({
      where: { communityId_userId: { communityId, userId: actor.sub } },
      data: { status: "Left" as never, leftAt: new Date() } as never,
    });
    await this.audit(actor, "community.left", "communities", communityId, { membershipId: membership.id });
    return { data: membership };
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
    const incidentType = this.incidentTypeFromPost(post.type as string);
    const incident = await this.incidents.report({
      type: incidentType,
      title: post.title,
      description: post.body,
      latitude: Number(post.latitude ?? 6.6012),
      longitude: Number(post.longitude ?? 3.3514),
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
