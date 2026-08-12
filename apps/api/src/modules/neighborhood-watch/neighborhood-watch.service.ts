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
import { assertEvidenceObjectKey, createS3PresignedPutUrl, evidenceObjectKey, validateEvidenceUpload } from "../../common/storage/s3-presign";
import { communityRoleCan, isCommunityAdminRole, isModeratorRole, platformAdminCan } from "./community-permissions";
import { DangerZoneGeoService } from "../danger-zones/danger-zone-geo.service";
import { IncidentsService } from "../incidents/incidents.service";
import { NotificationsService } from "../notifications/notifications.service";
import { buildNeighborhoodWatchNotificationMetadata } from "../notifications/notification-routing.schema";
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
  ListMembersQuery,
  ModerateMemberDto,
  PatrolCheckpointDto,
  PresignCommunityMediaDto,
  RegisterVolunteerDto,
  ReviewCommunityRequestDto,
  SendCommunityMessageDto,
  UpdateCommunityAlertDto,
  UpdateCommunityCommentDto,
  UpdatePinnedSafetyInfoDto,
  VerifyCommunityPostDto,
  UpdateCommunityDto,
  ListAdminMembershipsQuery,
  UpdateVolunteerAdminDto,
  UpdatePatrolScheduleDto,
  validateCommunity,
  validateCommunityRequest,
  validatePost,
  validateRegisterVolunteer,
  COMMUNITY_REPORT_REASONS,
  NW_DISCUSSION_POST_TYPES,
} from "./dto/neighborhood-watch.dto";
import { MAX_LOCATION_AGE_MS } from "./neighborhood-watch-context.service";

@Injectable()
export class NeighborhoodWatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly incidents: IncidentsService,
    private readonly broadcasts: BroadcastsService,
    private readonly notifications: NotificationsService,
    private readonly auditService: AuditService,
    private readonly dangerZoneGeo: DangerZoneGeoService,
  ) {}

  async listCommunities(actor: JwtPayload, query: ListCommunitiesQuery = {}) {
    const limit = resolvePageLimit(query.limit);
    const cursor = decodeDateIdCursor(query.cursor);
    const where: Record<string, unknown> = {};
    if (!query.status?.trim() || query.status === "Active") {
      where.status = "Active" as never;
    } else if (query.status === "all") {
      // no status filter
    } else {
      where.status = query.status.trim() as never;
    }
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

  async updateCommunity(id: string, dto: UpdateCommunityDto, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can update communities");
    await this.assertAdminCommunityScope(id, actor);
    const community = await this.prisma.community.findUnique({ where: { id } });
    if (!community) throw new NotFoundException("Community not found");

    if (dto.country || dto.state || dto.lga) {
      await this.assertAdminJurisdiction(
        actor,
        dto.country ?? community.country,
        dto.state ?? community.state ?? undefined,
        dto.lga ?? community.lga ?? undefined,
      );
    }
    if (dto.boundaryWkt) await this.assertValidBoundaryWkt(dto.boundaryWkt);

    const updated = await this.prisma.community.update({
      where: { id },
      data: {
        ...(dto.name?.trim() ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.visibility ? { visibility: dto.visibility as never } : {}),
        ...(dto.country ? { country: dto.country } : {}),
        ...(dto.state !== undefined ? { state: dto.state } : {}),
        ...(dto.lga !== undefined ? { lga: dto.lga } : {}),
        ...(dto.ward !== undefined ? { ward: dto.ward } : {}),
        ...(dto.estate !== undefined ? { estate: dto.estate } : {}),
        ...(dto.street !== undefined ? { street: dto.street } : {}),
        ...(dto.status ? { status: dto.status as never } : {}),
      } as never,
    });

    if (dto.boundaryWkt || dto.latitude !== undefined || dto.longitude !== undefined) {
      await this.writeCommunityLocation(id, {
        boundaryWkt: dto.boundaryWkt,
        latitude: dto.latitude,
        longitude: dto.longitude,
        name: updated.name,
        level: updated.level as CreateCommunityDto["level"],
        country: updated.country,
      });
    }

    await this.audit(actor, "community.updated", "communities", id, {
      status: dto.status,
      visibility: dto.visibility,
      boundaryUpdated: Boolean(dto.boundaryWkt),
    });
    return this.getCommunity(id, actor);
  }

  async getCommunityBoundary(id: string, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can export community boundaries");
    await this.assertAdminCommunityScope(id, actor);
    const rows = await this.prisma.$queryRawUnsafe<Array<{ wkt: string | null; area_sq_m: number | null }>>(
      `SELECT ST_AsText(boundary::geometry) AS wkt, ST_Area(boundary) AS area_sq_m FROM communities WHERE id = $1::uuid`,
      id,
    );
    const row = rows[0];
    if (!row?.wkt) return { data: { wkt: null, areaSqM: null, geojson: null } };
    return {
      data: {
        wkt: row.wkt,
        areaSqM: row.area_sq_m,
        geojson: { type: "Feature", geometry: { type: "MultiPolygon", note: "Use WKT import/export in admin console" } },
      },
    };
  }

  async listAdminMemberships(actor: JwtPayload, query: ListAdminMembershipsQuery = {}) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can list memberships");
    const limit = resolvePageLimit(query.limit);
    if (query.cursor?.trim() && !decodeDateIdCursor(query.cursor)) {
      throw new BadRequestException("cursor is invalid");
    }
    const cursor = decodeDateIdCursor(query.cursor);
    const where: Record<string, unknown> = {};
    if (query.status?.trim()) where.status = query.status.trim();
    if (query.communityId?.trim()) where.communityId = query.communityId.trim();
    if (query.q?.trim()) {
      where.OR = [
        { user: { email: { contains: query.q.trim(), mode: "insensitive" } } },
        { user: { profile: { firstName: { contains: query.q.trim(), mode: "insensitive" } } } },
        { user: { profile: { lastName: { contains: query.q.trim(), mode: "insensitive" } } } },
      ];
    }
    if (actor.role !== "Super Admin") {
      where.community = { country: actor.country, state: actor.state, lga: actor.lga };
    }

    const rows = await this.prisma.communityMembership.findMany({
      where: { ...where, ...dateIdCursorWhere(cursor) } as never,
      include: {
        community: { select: { id: true, name: true, country: true, state: true, lga: true } },
        role: { select: { name: true } },
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            profile: { select: { firstName: true, lastName: true, country: true, state: true, lga: true } },
            volunteerProfile: { select: { id: true, verified: true } },
          },
        },
      },
      orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    return buildCursorPage(rows, limit, (item) => encodeDateIdCursor(item.requestedAt, item.id));
  }

  async updateVolunteerAdmin(id: string, dto: UpdateVolunteerAdminDto, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can update volunteers");
    if (dto.types) validateRegisterVolunteer({ types: dto.types, communityId: dto.communityId ?? undefined });
    const profile = await this.prisma.volunteerProfile.findUnique({ where: { id }, include: { community: true } });
    if (!profile) throw new NotFoundException("Volunteer profile not found");
    if (profile.community) {
      await this.assertAdminJurisdiction(actor, profile.community.country, profile.community.state ?? undefined, profile.community.lga ?? undefined);
    }
    const updated = await this.prisma.volunteerProfile.update({
      where: { id },
      data: {
        ...(dto.communityId !== undefined ? { communityId: dto.communityId } : {}),
        ...(dto.types ? { types: dto.types as never } : {}),
        ...(dto.verified !== undefined ? { verified: dto.verified } : {}),
        ...(dto.available !== undefined ? { available: dto.available } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
      } as never,
    });
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE volunteer_profiles SET gps_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE id = $3::uuid`,
        dto.longitude,
        dto.latitude,
        id,
      );
    }
    await this.audit(actor, "community.volunteer_updated", "volunteer_profiles", id, dto as Record<string, unknown>);
    return { data: updated };
  }

  async updatePatrolSchedule(scheduleId: string, dto: UpdatePatrolScheduleDto, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can update patrol schedules");
    const schedule = await this.prisma.patrolSchedule.findUnique({ where: { id: scheduleId }, include: { community: true } });
    if (!schedule) throw new NotFoundException("Patrol schedule not found");
    await this.assertAdminJurisdiction(actor, schedule.community.country, schedule.community.state ?? undefined, schedule.community.lga ?? undefined);
    const updated = await this.prisma.patrolSchedule.update({
      where: { id: scheduleId },
      data: {
        ...(dto.status ? { status: dto.status as never } : {}),
        ...(dto.title?.trim() ? { title: dto.title.trim() } : {}),
        ...(dto.startsAt ? { startsAt: new Date(dto.startsAt) } : {}),
        ...(dto.endsAt ? { endsAt: new Date(dto.endsAt) } : {}),
      } as never,
    });
    await this.audit(actor, "community.patrol_updated", "patrol_schedules", scheduleId, dto as Record<string, unknown>);
    return { data: updated };
  }

  async getPatrolSchedule(scheduleId: string, actor: JwtPayload) {
    await this.assertDispatchReader(actor);
    const schedule = await this.prisma.patrolSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        community: { select: { id: true, name: true, country: true, state: true, lga: true } },
        checkpoints: true,
        assignments: { include: { user: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } } } },
      },
    });
    if (!schedule) throw new NotFoundException("Patrol schedule not found");
    if (actor.typ === "admin") {
      await this.assertAdminJurisdiction(actor, schedule.community.country, schedule.community.state ?? undefined, schedule.community.lga ?? undefined);
      return { data: schedule };
    }
    await this.assertCommunityVisible(schedule.communityId, actor);
    return { data: schedule };
  }

  private assertDispatchReader(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Admin authentication required");
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
    if (community.status !== "Active" && actor.typ !== "admin") {
      throw new ForbiddenException("Community is not active");
    }
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
    await this.notifyUser(
      membership.userId,
      "Join request declined",
      note ?? "Your community join request was declined",
      buildNeighborhoodWatchNotificationMetadata({
        routeType: "NW_MEMBERSHIP_REJECTED",
        communityId,
        notificationType: "NwMembershipRejected",
      }),
    );
    return { data: updated };
  }

  async listMembers(communityId: string, actor: JwtPayload, query: ListMembersQuery = {}) {
    await this.assertCommunityVisible(communityId, actor);
    const limit = resolvePageLimit(query.limit);
    const cursor = decodeDateIdCursor(query.cursor);
    const search = query.search?.trim();
    const rows = await this.prisma.communityMembership.findMany({
      where: {
        communityId,
        status: "Approved" as never,
        ...(search
          ? {
              OR: [
                { user: { profile: { firstName: { contains: search, mode: "insensitive" } } } },
                { user: { profile: { lastName: { contains: search, mode: "insensitive" } } } },
              ],
            }
          : {}),
        ...dateIdCursorWhere(cursor),
      } as never,
      include: {
        role: { select: { name: true } },
        user: {
          select: {
            id: true,
            profile: { select: { firstName: true, lastName: true } },
            volunteerProfile: { select: { id: true, verified: true, communityId: true, types: true } },
          },
        },
      },
      orderBy: [{ approvedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = buildCursorPage(rows, limit, (item) => encodeDateIdCursor(item.approvedAt ?? item.requestedAt, item.id));
    return {
      ...page,
      data: page.data.map((membership) => {
        const roleName = membership.role?.name ?? "Resident";
        const volunteer = membership.user.volunteerProfile;
        const badges: string[] = [roleName];
        if (volunteer?.communityId === communityId && volunteer.verified) badges.push("Volunteer");
        if (isModeratorRole(roleName)) badges.push("Moderator");
        if (roleName === "VolunteerCoordinator" || roleName === "SecurityCoordinator") badges.push("PatrolLead");
        return {
          id: membership.id,
          userId: membership.userId,
          displayName: [membership.user.profile?.firstName, membership.user.profile?.lastName].filter(Boolean).join(" ") || "Member",
          role: roleName,
          badges,
          isVolunteer: volunteer?.communityId === communityId,
          approvedAt: membership.approvedAt,
        };
      }),
    };
  }

  async getCommunityStatistics(communityId: string, actor: JwtPayload) {
    await this.assertCommunityVisible(communityId, actor);
    if (actor.typ === "user") {
      const membership = await this.prisma.communityMembership.findUnique({
        where: { communityId_userId: { communityId, userId: actor.sub } },
        include: { role: true },
      });
      if (!membership || membership.status !== "Approved" || !communityRoleCan(membership.role?.name as string, "community_statistics")) {
        if (!isModeratorRole(membership?.role?.name as string)) {
          throw new ForbiddenException("Community statistics are restricted to moderators");
        }
      }
    } else if (!platformAdminCan(actor, "community_statistics")) {
      await this.assertAdminCommunityScope(communityId, actor);
    }
    const alertTypes = ["SuspiciousActivity", "LostChild", "MissingPerson", "CrimeAlert", "AccidentAlert", "FireAlert", "FloodWarning"];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      memberCount,
      activeVolunteers,
      patrolCount,
      activeAlerts,
      incidentCount,
      postCount,
      commentCount,
      recentMembers,
    ] = await Promise.all([
      this.prisma.communityMembership.count({ where: { communityId, status: "Approved" as never } }),
      this.prisma.volunteerProfile.count({ where: { communityId, available: true, verified: true } }),
      this.prisma.patrolSchedule.count({ where: { communityId } }),
      this.prisma.communityPost.count({
        where: { communityId, type: { in: alertTypes as never }, verificationStatus: "Verified" as never },
      }),
      this.prisma.communityPost.count({ where: { communityId, incidentId: { not: null } } }),
      this.prisma.communityPost.count({ where: { communityId } }),
      this.prisma.communityPostComment.count({ where: { post: { communityId } } }),
      this.prisma.communityMembership.count({ where: { communityId, status: "Approved" as never, approvedAt: { gte: thirtyDaysAgo } } }),
    ]);
    return {
      data: {
        communityId,
        memberCount,
        activeVolunteers,
        patrolCount,
        activeAlerts,
        incidentCount,
        postCount,
        commentCount,
        memberGrowth30Days: recentMembers,
      },
    };
  }

  async moderateMember(communityId: string, membershipId: string, dto: ModerateMemberDto, actor: JwtPayload) {
    await this.assertModerator(communityId, actor);
    const membership = await this.prisma.communityMembership.findUnique({ where: { id: membershipId }, include: { role: true } });
    if (!membership || membership.communityId !== communityId) throw new NotFoundException("Membership not found");
    if (isCommunityAdminRole(membership.role?.name as string) && actor.typ === "user") {
      const actorMembership = await this.prisma.communityMembership.findUnique({
        where: { communityId_userId: { communityId, userId: actor.sub } },
        include: { role: true },
      });
      if (!isCommunityAdminRole(actorMembership?.role?.name as string)) {
        throw new ForbiddenException("Only community admins can moderate other admins");
      }
    }
    const statusMap = {
      suspend: "Suspended",
      restore: "Approved",
      ban: "Banned",
      unban: "Approved",
    } as const;
    const updated = await this.prisma.communityMembership.update({
      where: { id: membershipId },
      data: {
        status: statusMap[dto.action] as never,
        moderatorNote: dto.note,
        moderatedById: actor.sub,
        moderatedAt: new Date(),
      } as never,
    });
    await this.audit(actor, `community.member_${dto.action}`, "community_memberships", membershipId, { communityId, note: dto.note });
    await this.notifyUser(
      membership.userId,
      dto.action === "restore" || dto.action === "unban" ? "Membership restored" : "Membership restricted",
      dto.note ?? `Your community membership was ${dto.action}ed`,
      { communityId },
    );
    return { data: updated };
  }

  async removePost(postId: string, actor: JwtPayload, note?: string) {
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException("Community post not found");
    await this.assertModerator(post.communityId, actor);
    await this.prisma.communityPost.update({
      where: { id: postId },
      data: { hiddenAt: new Date() } as never,
    });
    await this.audit(actor, "community.post_removed", "community_posts", postId, { communityId: post.communityId, note });
    return { data: { id: postId, removed: true, softDeleted: true } };
  }

  async restorePost(postId: string, actor: JwtPayload) {
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException("Community post not found");
    await this.assertModerator(post.communityId, actor);
    await this.prisma.communityPost.update({
      where: { id: postId },
      data: { hiddenAt: null } as never,
    });
    await this.audit(actor, "community.post_restored", "community_posts", postId, { communityId: post.communityId });
    return { data: { id: postId, restored: true } };
  }

  async presignPostMedia(communityId: string, dto: PresignCommunityMediaDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can upload community media");
    await this.assertCanParticipate(communityId, actor);
    if (!dto.fileName || !dto.contentType || !dto.mediaType) throw new BadRequestException("fileName, contentType, and mediaType are required");
    validateEvidenceUpload(dto.contentType, dto.sizeBytes);
    const prefix = `community-${communityId}`;
    const objectKey = evidenceObjectKey(prefix, dto.fileName);
    return {
      data: {
        bucket: process.env.S3_BUCKET ?? "the-eye",
        objectKey,
        uploadUrl: createS3PresignedPutUrl(objectKey, 300, dto.contentType),
        requiredHeaders: { "content-type": dto.contentType },
        expiresInSeconds: 300,
      },
    };
  }

  async reviewContentReport(reportId: string, dto: { action: "reviewed" | "dismissed"; note?: string }, actor: JwtPayload) {
    const report = await this.prisma.communityContentReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException("Report not found");
    await this.assertModerator(report.communityId, actor);
    const updated = await this.prisma.communityContentReport.update({
      where: { id: reportId },
      data: {
        status: dto.action === "reviewed" ? "Reviewed" as never : "Dismissed" as never,
        reviewedById: actor.sub,
        reviewedAt: new Date(),
      } as never,
    });
    await this.audit(actor, "community.report_reviewed", "community_content_reports", reportId, { action: dto.action, note: dto.note });
    return { data: updated };
  }

  async approveMember(communityId: string, membershipId: string, actor: JwtPayload) {
    await this.assertModerator(communityId, actor);
    const membership = await this.prisma.communityMembership.update({
      where: { id: membershipId },
      data: { status: "Approved" as never, approvedById: actor.sub, approvedAt: new Date() } as never,
    });
    await this.audit(actor, "community.member_approved", "community_memberships", membership.id, { communityId });
    await this.notifyUser(
      membership.userId,
      "Join request approved",
      "You can now participate in your community",
      buildNeighborhoodWatchNotificationMetadata({
        routeType: "NW_MEMBERSHIP_APPROVED",
        communityId,
        notificationType: "NwMembershipApproved",
      }),
    );
    return { data: membership };
  }

  async leaveCommunity(communityId: string, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can leave communities");
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException("Community not found");
    if (community.createdById === actor.sub) {
      throw new BadRequestException("Transfer community ownership or archive the community before leaving as owner");
    }
    const membership = await this.prisma.communityMembership.findUnique({
      where: { communityId_userId: { communityId, userId: actor.sub } },
      include: { role: true },
    });
    if (!membership || membership.status !== "Approved") throw new NotFoundException("Membership not found");
    if (isCommunityAdminRole(membership.role?.name as string) || isModeratorRole(membership.role?.name as string)) {
      throw new BadRequestException("Transfer community moderator responsibilities before leaving");
    }
    const activePatrol = await this.prisma.patrolAssignment.findFirst({
      where: {
        userId: actor.sub,
        schedule: { communityId, status: { in: ["Scheduled", "Active"] as never } },
      },
    });
    if (activePatrol) throw new BadRequestException("Complete or leave your active patrol assignment before leaving the community");
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
    await this.assertCanParticipate(communityId, actor);
    if (dto.media?.length) {
      for (const media of dto.media) {
        assertEvidenceObjectKey(`community-${communityId}`, media.objectKey, media.bucket, media.contentType);
      }
    }
    const hazardStatus =
      dto.type === "RoadHazard" || dto.type === "LocalWarning"
        ? (dto.hazardStatus ?? "Open")
        : undefined;
    const post = await this.prisma.communityPost.create({
      data: {
        communityId,
        authorId: actor.sub,
        type: dto.type as never,
        title: dto.title.trim(),
        body: dto.body?.trim() ?? "",
        latitude: dto.latitude,
        longitude: dto.longitude,
        hazardStatus: hazardStatus as never,
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
    const authorLabel = await this.resolveAuthorLabel(communityId, actor.sub);
    const routeType = NW_DISCUSSION_POST_TYPES.has(dto.type) ? "NW_NEW_DISCUSSION" : "NW_POST_ACTIVITY";
    await this.notifyCommunity(
      communityId,
      post.id,
      scored.title,
      this.notificationBody(scored.type as string),
      routeType,
      { postId: post.id },
    );
    await this.audit(actor, "community.post_created", "community_posts", post.id, { communityId, type: dto.type });
    return { data: { ...scored, authorLabel } };
  }

  async listPosts(actor: JwtPayload, query: CursorPageQuery = {}) {
    const communityWhere =
      actor.typ === "admin" && actor.role !== "Super Admin"
        ? { country: actor.country, state: actor.state, lga: actor.lga }
        : {};
    const limit = resolvePageLimit(query.limit);
    const cursor = decodeDateIdCursor(query.cursor);
    const visibilityFilter =
      actor.typ === "admin"
        ? {}
        : {
            OR: [
              { community: { visibility: "Public" as const, status: "Active" as const } },
              {
                community: {
                  visibility: "Private" as const,
                  status: "Active" as const,
                  memberships: {
                    some: { userId: actor.sub, status: "Approved" as const },
                  },
                },
              },
            ],
          };
    const rows = await this.prisma.communityPost.findMany({
      where: {
        hiddenAt: null,
        ...(Object.keys(communityWhere).length ? { community: communityWhere } : {}),
        ...visibilityFilter,
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
      where: { communityId, hiddenAt: null, ...dateIdCursorWhere(cursor) },
      include: {
        media: true,
        comments: true,
        reactions: true,
        verifications: true,
        incident: true,
        broadcast: true,
        author: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = buildCursorPage(rows, limit, (item) => encodeDateIdCursor(item.createdAt, item.id));
    const labels = await this.resolveAuthorLabels(
      communityId,
      page.data.map((row) => row.authorId),
    );
    return {
      ...page,
      data: page.data.map((row) => ({
        ...row,
        authorLabel: labels.get(row.authorId) ?? "Community member",
        commentCount: Array.isArray(row.comments) ? row.comments.length : 0,
      })),
    };
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
    if (post.isEscalated && post.incidentId) {
      return {
        data: {
          id: post.incidentId,
          duplicate: true,
          sourceCommunityId: post.communityId,
          sourceCommunityPostId: post.id,
          resultingIncidentId: post.incidentId,
        },
      };
    }
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
    await this.prisma.communityPost.update({
      where: { id: postId },
      data: {
        incidentId: incidentData.id,
        isEscalated: true,
        escalatedAt: new Date(),
        escalatedById: actor.sub,
      } as never,
    });
    await this.audit(actor, "community.post_converted_to_incident", "community_posts", postId, {
      incidentId: incidentData.id,
      sourceCommunityId: post.communityId,
      sourceCommunityPostId: postId,
      escalatedBy: actor.sub,
    });
    return {
      data: {
        id: incidentData.id,
        sourceCommunityId: post.communityId,
        sourceCommunityPostId: post.id,
        resultingIncidentId: incidentData.id,
        escalatedAt: new Date().toISOString(),
        escalatedBy: actor.sub,
      },
    };
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
    const centerRows = await this.prisma.$queryRawUnsafe<Array<{ lng: number; lat: number }>>(
      `SELECT ST_X(center::geometry) AS lng, ST_Y(center::geometry) AS lat
         FROM communities
        WHERE id = $1::uuid AND center IS NOT NULL
        LIMIT 1`,
      communityId,
    );
    const [posts, policeStations, volunteers, patrols, alerts, pinned] = await Promise.all([
      this.prisma.communityPost.findMany({
        where: { communityId, hiddenAt: null },
        take: DEFAULT_PAGE_LIMIT,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          title: true,
          latitude: true,
          longitude: true,
          verificationStatus: true,
          hazardStatus: true,
          createdAt: true,
        },
      }),
      this.prisma.policeStation.findMany({ take: 50 }),
      this.prisma.volunteerProfile.findMany({ where: { communityId, available: true }, take: 50 }),
      this.prisma.patrolSchedule.findMany({ where: { communityId }, include: { checkpoints: true }, take: 20 }),
      this.prisma.communityAlert.findMany({
        where: { communityId, status: "Active" },
        take: 20,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.communityPinnedSafetyInfo.findMany({
        where: { communityId, active: true },
        orderBy: { sortOrder: "asc" },
        take: 20,
      }),
    ]);
    const dangerZones = await this.citizenSafeDangerZones(
      centerRows[0]?.lat != null ? Number(centerRows[0].lat) : null,
      centerRows[0]?.lng != null ? Number(centerRows[0].lng) : null,
    );
    return {
      data: {
        posts,
        policeStations,
        volunteers,
        patrols,
        alerts,
        pinnedSafetyInfo: pinned,
        safePoints: [],
        hospitals: [],
        dangerZones,
      },
    };
  }

  async registerVolunteer(dto: RegisterVolunteerDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can register as volunteers");
    validateRegisterVolunteer(dto);
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
    const volunteerIds = Array.from(new Set((dto.volunteerUserIds ?? []).filter(Boolean)));
    for (const userId of volunteerIds) {
      await this.assertApprovedMember(communityId, userId);
      const volunteer = await this.prisma.volunteerProfile.findFirst({ where: { userId, communityId } });
      if (!volunteer) continue;
      await this.prisma.patrolAssignment.create({
        data: {
          scheduleId: schedule.id,
          volunteerId: volunteer.id,
          userId,
        } as never,
      });
    }
    await this.audit(actor, "community.patrol_created", "patrol_schedules", schedule.id, {
      communityId,
      assigned: volunteerIds.length,
    });
    return { data: schedule };
  }

  async joinPatrol(scheduleId: string, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can join patrols");
    const schedule = await this.prisma.patrolSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) throw new NotFoundException("Patrol not found");
    await this.assertApprovedMember(schedule.communityId, actor.sub);
    if (!["Scheduled", "Active"].includes(String(schedule.status))) {
      throw new BadRequestException("Patrol is not open for joining");
    }
    let volunteer = await this.prisma.volunteerProfile.findFirst({
      where: { userId: actor.sub, communityId: schedule.communityId },
    });
    if (!volunteer) {
      volunteer = await this.prisma.volunteerProfile.create({
        data: {
          userId: actor.sub,
          communityId: schedule.communityId,
          types: ["SecurityVolunteer"] as never,
        } as never,
      });
    }
    const assignment = await this.prisma.patrolAssignment.upsert({
      where: { scheduleId_userId: { scheduleId, userId: actor.sub } } as never,
      update: {},
      create: {
        scheduleId,
        volunteerId: volunteer.id,
        userId: actor.sub,
      } as never,
    }).catch(async () => {
      const existing = await this.prisma.patrolAssignment.findFirst({
        where: { scheduleId, userId: actor.sub },
      });
      if (existing) return existing;
      return this.prisma.patrolAssignment.create({
        data: { scheduleId, volunteerId: volunteer!.id, userId: actor.sub } as never,
      });
    });
    await this.audit(actor, "community.patrol_joined", "patrol_assignments", assignment.id, { scheduleId });
    return { data: assignment };
  }

  async createPatrolObservation(scheduleId: string, dto: { note: string; latitude?: number; longitude?: number }, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can report patrol observations");
    const schedule = await this.prisma.patrolSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) throw new NotFoundException("Patrol not found");
    const assignment = await this.prisma.patrolAssignment.findFirst({ where: { scheduleId, userId: actor.sub } });
    if (!assignment) throw new ForbiddenException("Patrol assignment required");
    if (String(schedule.status) !== "Active") throw new BadRequestException("Patrol must be active");
    const report = await this.prisma.patrolReport.create({
      data: {
        scheduleId,
        submittedById: actor.sub,
        summary: dto.note.trim(),
        issuesFound: false,
      } as never,
    });
    await this.audit(actor, "community.patrol_observation", "patrol_reports", report.id, {
      scheduleId,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });
    return { data: report };
  }

  async createCommunityAlert(
    communityId: string,
    dto: {
      title: string;
      body: string;
      audience?: string;
      radiusM?: number;
      latitude?: number;
      longitude?: number;
      expiresAt?: string;
    },
    actor: JwtPayload,
  ) {
    await this.assertModerator(communityId, actor);
    if (!dto.title?.trim() || !dto.body?.trim()) throw new BadRequestException("Alert title and body are required");
    const alert = await this.prisma.communityAlert.create({
      data: {
        communityId,
        createdById: actor.sub,
        title: dto.title.trim(),
        body: dto.body.trim(),
        audience: (dto.audience ?? "EntireCommunity") as never,
        radiusM: dto.radiusM,
        latitude: dto.latitude,
        longitude: dto.longitude,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        status: "Active",
      } as never,
    });
    await this.notifyCommunity(communityId, alert.id, alert.title, alert.body.slice(0, 160), "NW_COMMUNITY_ALERT");
    await this.audit(actor, "community.alert_created", "community_alerts", alert.id, { communityId });
    return { data: alert };
  }

  async listCommunityAlerts(communityId: string, actor: JwtPayload) {
    await this.assertCommunityVisible(communityId, actor);
    const rows = await this.prisma.communityAlert.findMany({
      where: {
        communityId,
        status: "Active",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { data: rows };
  }

  async updateCommunityAlert(communityId: string, alertId: string, dto: UpdateCommunityAlertDto, actor: JwtPayload) {
    await this.assertModerator(communityId, actor);
    const existing = await this.prisma.communityAlert.findFirst({ where: { id: alertId, communityId } });
    if (!existing) throw new NotFoundException("Community alert not found");
    const updated = await this.prisma.communityAlert.update({
      where: { id: alertId },
      data: {
        ...(dto.title?.trim() ? { title: dto.title.trim() } : {}),
        ...(dto.body?.trim() ? { body: dto.body.trim() } : {}),
        ...(dto.audience ? { audience: dto.audience as never } : {}),
        ...(dto.radiusM !== undefined ? { radiusM: dto.radiusM } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.expiresAt !== undefined
          ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }
          : {}),
        ...(dto.status ? { status: dto.status as never } : {}),
      },
    });
    await this.audit(actor, "community.alert_updated", "community_alerts", alertId, {
      communityId,
      status: updated.status,
    });
    return { data: updated };
  }

  async cancelCommunityAlert(communityId: string, alertId: string, actor: JwtPayload) {
    return this.updateCommunityAlert(communityId, alertId, { status: "Cancelled" }, actor);
  }

  async createPinnedSafetyInfo(
    communityId: string,
    dto: { title: string; body: string; category: string; sortOrder?: number },
    actor: JwtPayload,
  ) {
    await this.assertModerator(communityId, actor);
    const row = await this.prisma.communityPinnedSafetyInfo.create({
      data: {
        communityId,
        title: dto.title.trim(),
        body: dto.body.trim(),
        category: dto.category.trim(),
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    return { data: row };
  }

  async listPinnedSafetyInfo(communityId: string, actor: JwtPayload) {
    await this.assertCommunityVisible(communityId, actor);
    const rows = await this.prisma.communityPinnedSafetyInfo.findMany({
      where: { communityId, active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 50,
    });
    return { data: rows };
  }

  async updatePinnedSafetyInfo(
    communityId: string,
    pinnedId: string,
    dto: UpdatePinnedSafetyInfoDto,
    actor: JwtPayload,
  ) {
    await this.assertModerator(communityId, actor);
    const existing = await this.prisma.communityPinnedSafetyInfo.findFirst({
      where: { id: pinnedId, communityId },
    });
    if (!existing) throw new NotFoundException("Pinned safety info not found");
    const updated = await this.prisma.communityPinnedSafetyInfo.update({
      where: { id: pinnedId },
      data: {
        ...(dto.title?.trim() ? { title: dto.title.trim() } : {}),
        ...(dto.body?.trim() ? { body: dto.body.trim() } : {}),
        ...(dto.category?.trim() ? { category: dto.category.trim() } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
    await this.audit(actor, "community.pinned_safety_updated", "community_pinned_safety_info", pinnedId, {
      communityId,
      active: updated.active,
    });
    return { data: updated };
  }

  async deactivatePinnedSafetyInfo(communityId: string, pinnedId: string, actor: JwtPayload) {
    return this.updatePinnedSafetyInfo(communityId, pinnedId, { active: false }, actor);
  }

  async transitionPatrol(
    scheduleId: string,
    status: "Active" | "Paused" | "Completed" | "Cancelled",
    actor: JwtPayload,
  ) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can transition citizen patrols");
    const schedule = await this.prisma.patrolSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) throw new NotFoundException("Patrol not found");
    await this.assertApprovedMember(schedule.communityId, actor.sub);
    const assignment = await this.prisma.patrolAssignment.findFirst({
      where: { scheduleId, userId: actor.sub },
    });
    const canManage = await this.canManagePatrol(schedule.communityId, actor.sub);
    if (!assignment && !canManage) throw new ForbiddenException("Patrol assignment or coordinator role required");

    const current = String(schedule.status);
    const allowed: Record<string, string[]> = {
      Active: ["Scheduled", "Paused"],
      Paused: ["Active"],
      Completed: ["Active", "Paused"],
      Cancelled: ["Scheduled", "Active", "Paused"],
    };
    if (!allowed[status]?.includes(current)) {
      throw new BadRequestException(`Cannot move patrol from ${current} to ${status}`);
    }
    const updated = await this.prisma.patrolSchedule.update({
      where: { id: scheduleId },
      data: { status: status as never },
    });
    await this.audit(actor, "community.patrol_transitioned", "patrol_schedules", scheduleId, {
      from: current,
      to: status,
    });
    await this.notifyCommunity(
      schedule.communityId,
      scheduleId,
      `Patrol ${status.toLowerCase()}`,
      schedule.title,
      "NW_PATROL_UPDATE",
      { patrolId: scheduleId },
    );
    return { data: updated };
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
    const labels = await this.resolveAuthorLabels(
      post.communityId,
      page.data.map((comment) => comment.author.id),
    );
    return {
      ...page,
      data: page.data.map((comment) => {
        const displayName =
          [comment.author.profile?.firstName, comment.author.profile?.lastName].filter(Boolean).join(" ") || "Member";
        const authorLabel = labels.get(comment.author.id) ?? "Community member";
        return {
          id: comment.id,
          body: comment.body,
          hasVoice: Boolean(comment.objectKey && comment.mediaType === "Audio"),
          durationSeconds: comment.durationSeconds,
          mediaType: comment.mediaType,
          createdAt: comment.createdAt,
          authorLabel,
          author: {
            id: comment.author.id,
            displayName: authorLabel === "Current Area Visitor" ? "Current Area Visitor" : displayName,
          },
        };
      }),
    };
  }

  async createPostComment(postId: string, dto: CreateCommunityCommentDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can comment");
    const hasVoice = Boolean(dto.objectKey && dto.bucket && dto.mediaType === "Audio");
    if (!dto.body?.trim() && !hasVoice) {
      throw new BadRequestException("Comment body or voice attachment is required");
    }
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException("Community post not found");
    await this.assertCanParticipate(post.communityId, actor);
    const priorCommenters = await this.prisma.communityPostComment.findMany({
      where: { postId, authorId: { not: actor.sub } },
      select: { authorId: true },
      distinct: ["authorId"],
      take: 100,
    });
    const comment = await this.prisma.communityPostComment.create({
      data: {
        postId,
        authorId: actor.sub,
        body: dto.body?.trim() ?? "",
        mediaType: hasVoice ? dto.mediaType : undefined,
        bucket: hasVoice ? dto.bucket : undefined,
        objectKey: hasVoice ? dto.objectKey : undefined,
        contentType: hasVoice ? dto.contentType : undefined,
        durationSeconds: hasVoice ? dto.durationSeconds : undefined,
      },
    });
    await this.audit(actor, "community.comment_created", "community_post_comments", comment.id, {
      postId,
      hasVoice,
    });
    const snippet = (dto.body?.trim() || "Voice comment").slice(0, 120);
    if (post.authorId !== actor.sub) {
      await this.notifyUser(
        post.authorId,
        "New comment on your post",
        snippet,
        buildNeighborhoodWatchNotificationMetadata({
          routeType: "NW_POST_COMMENT",
          communityId: post.communityId,
          postId,
          notificationType: "NwPostComment",
        }),
      );
    }
    const replyTargets = priorCommenters
      .map((row) => row.authorId)
      .filter((userId) => userId !== post.authorId);
    for (const userId of replyTargets) {
      await this.notifyUser(
        userId,
        "New reply in a discussion",
        snippet,
        buildNeighborhoodWatchNotificationMetadata({
          routeType: "NW_POST_REPLY",
          communityId: post.communityId,
          postId,
          notificationType: "NwPostReply",
        }),
      );
    }
    const authorLabel = await this.resolveAuthorLabel(post.communityId, actor.sub);
    return {
      data: {
        id: comment.id,
        body: comment.body,
        hasVoice,
        durationSeconds: comment.durationSeconds,
        createdAt: comment.createdAt,
        authorLabel,
        author: {
          id: actor.sub,
          displayName: authorLabel === "Current Area Visitor" ? "Current Area Visitor" : "Member",
        },
      },
    };
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
    await this.assertCanParticipate(post.communityId, actor);
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
    await this.assertCanParticipate(post.communityId, actor);
    await this.prisma.communityPostReaction.deleteMany({ where: { postId, userId: actor.sub, type: type as never } });
    await this.audit(actor, "community.reaction_deleted", "community_post_reactions", postId, { type });
    return { data: { postId, type, deleted: true } };
  }

  async createContentReport(communityId: string, dto: CreateCommunityContentReportDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can submit reports");
    await this.assertCanParticipate(communityId, actor);
    if (!COMMUNITY_REPORT_REASONS.includes(dto.reasonCode as never) && dto.reasonCode !== "Other") {
      throw new BadRequestException("Invalid report reason code");
    }
    if (dto.evidenceObjectKey) {
      assertEvidenceObjectKey(`community-${communityId}`, dto.evidenceObjectKey, dto.evidenceBucket ?? process.env.S3_BUCKET ?? "the-eye");
    }
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
    const authorLabel = await this.resolveAuthorLabel(post.communityId, post.authorId);
    return { data: { ...post, authorLabel, commentCount: post.comments?.length ?? 0 } };
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

  /** Public: approved member OR fresh location presence. Private: approved membership only. */
  private async assertCanParticipate(communityId: string, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community || community.status !== "Active") throw new NotFoundException("Community not found");
    if (community.visibility === "Private") {
      await this.assertApprovedMember(communityId, actor.sub);
      return;
    }
    const membership = await this.prisma.communityMembership.findUnique({
      where: { communityId_userId: { communityId, userId: actor.sub } },
    });
    if (membership?.status === "Approved") return;
    if (membership?.status === "Suspended" || membership?.status === "Banned") {
      throw new ForbiddenException("Suspended or banned members cannot perform this action");
    }
    const presence = await this.prisma.communityPresence.findFirst({
      where: {
        userId: actor.sub,
        communityId,
        mode: "LocationParticipant",
        expiresAt: { gt: new Date() },
      },
      orderBy: { capturedAt: "desc" },
    });
    if (!presence) {
      throw new ForbiddenException("Resolve current location context before participating in this public community");
    }
    const ageMs = Date.now() - new Date(presence.capturedAt).getTime();
    if (ageMs > MAX_LOCATION_AGE_MS || ageMs < -60_000) {
      throw new ForbiddenException("Location proof is stale; refresh Neighborhood Watch context before posting");
    }
  }

  private async resolveAuthorLabel(communityId: string, userId: string): Promise<string> {
    const labels = await this.resolveAuthorLabels(communityId, [userId]);
    return labels.get(userId) ?? "Community member";
  }

  private async resolveAuthorLabels(communityId: string, userIds: string[]): Promise<Map<string, string>> {
    const unique = Array.from(new Set(userIds.filter(Boolean)));
    const result = new Map<string, string>();
    if (!unique.length) return result;
    const [memberships, presenceRows] = await Promise.all([
      this.prisma.communityMembership.findMany({
        where: { communityId, userId: { in: unique }, status: "Approved" as never },
        select: { userId: true },
      }),
      this.prisma.communityPresence.findMany({
        where: {
          communityId,
          userId: { in: unique },
          mode: "LocationParticipant",
          expiresAt: { gt: new Date() },
        },
        select: { userId: true },
      }),
    ]);
    const members = new Set(memberships.map((row) => row.userId));
    const visitors = new Set(presenceRows.map((row) => row.userId));
    for (const userId of unique) {
      if (members.has(userId)) {
        result.set(userId, "Community member");
      } else if (visitors.has(userId)) {
        result.set(userId, "Current Area Visitor");
      } else {
        result.set(userId, "Community member");
      }
    }
    return result;
  }

  private async assertApprovedMember(communityId: string, userId: string) {
    const membership = await this.prisma.communityMembership.findUnique({ where: { communityId_userId: { communityId, userId } }, include: { role: true } });
    if (!membership) throw new ForbiddenException("Approved community membership is required");
    if (membership.status === "Suspended" || membership.status === "Banned") {
      throw new ForbiddenException("Suspended or banned members cannot perform this action");
    }
    if (membership.status !== "Approved") throw new ForbiddenException("Approved community membership is required");
  }

  private async assertAdminCommunityScope(communityId: string, actor: JwtPayload) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException("Community not found");
    await this.assertAdminJurisdiction(actor, community.country, community.state ?? undefined, community.lga ?? undefined);
  }

  private async assertModerator(communityId: string, actor: JwtPayload) {
    if (actor.typ === "admin") {
      await this.assertAdminCommunityScope(communityId, actor);
      if (!platformAdminCan(actor, "moderate_member")) throw new ForbiddenException("Admin role cannot moderate this community");
      return;
    }
    const membership = await this.prisma.communityMembership.findUnique({ where: { communityId_userId: { communityId, userId: actor.sub } }, include: { role: true } });
    if (!membership || membership.status !== "Approved" || !membership.role || !isModeratorRole(membership.role.name as string)) {
      throw new ForbiddenException("Community moderator permissions are required");
    }
  }

  private async assertValidBoundaryWkt(wkt: string) {
    const trimmed = wkt.trim();
    if (!trimmed) throw new BadRequestException("boundaryWkt is required");
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ ok: boolean }>>(
        `SELECT ST_IsValid(ST_GeomFromText($1, 4326)) AS ok`,
        trimmed,
      );
      if (!rows[0]?.ok) throw new BadRequestException("Invalid community boundary WKT");
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException("Invalid community boundary WKT");
    }
  }

  private async writeCommunityLocation(id: string, dto: CreateCommunityDto) {
    if (dto.boundaryWkt) {
      await this.assertValidBoundaryWkt(dto.boundaryWkt);
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

  private async citizenSafeDangerZones(latitude: number | null, longitude: number | null) {
    if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return [];
    }
    const zones = await this.dangerZoneGeo.findActiveZonesNearPoint(longitude, latitude, 8000);
    return zones.map((zone) => ({
      id: String(zone.id),
      status: String(zone.status ?? ""),
      severity: zone.severity != null ? String(zone.severity) : null,
      distanceMeters: zone.distance_meters != null ? Number(zone.distance_meters) : null,
      publicMessage: zone.public_message != null ? String(zone.public_message) : null,
      avoidanceInstruction:
        zone.avoidance_instruction != null ? String(zone.avoidance_instruction) : null,
      innerRadiusMeters: zone.inner_radius_meters != null ? Number(zone.inner_radius_meters) : null,
      warningRadiusMeters:
        zone.warning_radius_meters != null ? Number(zone.warning_radius_meters) : null,
      outerAwarenessRadiusMeters:
        zone.outer_awareness_radius_meters != null
          ? Number(zone.outer_awareness_radius_meters)
          : null,
    }));
  }

  private async canManagePatrol(communityId: string, userId: string) {
    const membership = await this.prisma.communityMembership.findUnique({
      where: { communityId_userId: { communityId, userId } },
      include: { role: true },
    });
    const roleName = membership?.role?.name ? String(membership.role.name) : null;
    return Boolean(
      membership?.status === "Approved" &&
        roleName &&
        ["CommunityModerator", "EstateAdmin", "VolunteerCoordinator"].includes(roleName),
    );
  }

  private async notifyCommunity(
    communityId: string,
    entityId: string,
    title: string,
    body: string,
    routeType:
      | "NW_COMMUNITY_ALERT"
      | "NW_POST_ACTIVITY"
      | "NW_NEW_DISCUSSION"
      | "NW_PATROL_UPDATE" = "NW_POST_ACTIVITY",
    extras?: { patrolId?: string; postId?: string },
  ) {
    const postBound =
      routeType === "NW_POST_ACTIVITY" || routeType === "NW_NEW_DISCUSSION";
    const metadata = buildNeighborhoodWatchNotificationMetadata({
      routeType,
      communityId,
      postId: extras?.postId ?? (postBound ? entityId : undefined),
      patrolId: extras?.patrolId,
      notificationType: routeType,
    });
    const members = await this.prisma.communityMembership.findMany({
      where: { communityId, status: "Approved" as never },
      take: 500,
    });
    for (const member of members) {
      const notification = await this.prisma.notification.create({
        data: {
          userId: member.userId,
          communityId,
          channel: "push",
          title,
          body,
          status: "Pending" as never,
          provider: "fcm",
        } as never,
      });
      await this.notifications.enqueue({
        userId: member.userId,
        notificationId: notification.id,
        communityId,
        title,
        body,
        ...metadata,
      });
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
