import { Injectable } from "@nestjs/common";
import { IncidentType } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { PrismaService } from "../prisma/prisma.service";

type AiIntelligenceQuery = {
  windowDays?: number;
  communityId?: string;
};

@Injectable()
export class AiIntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(actor: JwtPayload, query: AiIntelligenceQuery = {}) {
    const windowDays = Math.min(Math.max(Number(query.windowDays ?? 30), 1), 365);
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const scopedCommunity = query.communityId
      ? await this.prisma.community.findUnique({
          where: { id: query.communityId },
          select: { id: true, country: true, state: true, lga: true },
        })
      : null;
    const communityWhere = this.communityScopeWhere(actor, scopedCommunity);
    const incidentWhere = this.incidentScopeWhere(actor, scopedCommunity, since);
    const postWhere = {
      createdAt: { gte: since },
      community: communityWhere,
    };

    const [posts, incidents, volunteers, communities] = await Promise.all([
      this.prisma.communityPost.findMany({
        where: postWhere as never,
        select: {
          id: true,
          title: true,
          body: true,
          confidenceScore: true,
          verificationStatus: true,
          communityId: true,
          community: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      this.prisma.incident.findMany({
        where: incidentWhere as never,
        select: {
          id: true,
          title: true,
          type: true,
          latitude: true,
          longitude: true,
          createdAt: true,
          lga: true,
          state: true,
          verifications: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { confidence: true },
          },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 100,
      }),
      this.prisma.volunteerProfile.findMany({
        where: {
          available: true,
          verified: true,
          ...(scopedCommunity ? { communityId: scopedCommunity.id } : {}),
          ...(actor.typ === "admin" && actor.role !== "Super Admin"
            ? { community: { country: actor.country, state: actor.state, lga: actor.lga } }
            : {}),
        },
        take: 500,
      }),
      this.prisma.community.count({ where: communityWhere as never }),
    ]);

    const confidenceValues = posts.map((post) => Number(post.confidenceScore ?? 0)).filter((score) => score > 0);
    const avgCommunityConfidence = confidenceValues.length
      ? Math.round(confidenceValues.reduce((sum, score) => sum + score, 0) / confidenceValues.length)
      : 0;
    const falsePosts = posts.filter((post) => post.verificationStatus === "FalseInformation").length;
    const falseReportRate = posts.length ? Math.round((falsePosts / posts.length) * 100) : 0;
    const hotspots = incidents
      .filter((incident) => incident.type === IncidentType.CommunitySafety)
      .sort((left, right) => Number(right.verifications[0]?.confidence ?? 0) - Number(left.verifications[0]?.confidence ?? 0))
      .slice(0, 5)
      .map((incident) => ({
        id: incident.id,
        title: incident.title,
        location: [incident.state, incident.lga].filter(Boolean).join(" / ") || "Unknown",
        confidenceScore: Number(incident.verifications[0]?.confidence ?? 0),
        latitude: Number(incident.latitude),
        longitude: Number(incident.longitude),
        createdAt: incident.createdAt.toISOString(),
      }));

    return {
      data: {
        communityRiskScore: Math.max(0, 100 - avgCommunityConfidence),
        crimeHotspotCount: hotspots.length,
        falseReportRate,
        volunteerCoverage: volunteers.length,
        avgCommunityConfidence,
        hotspots,
        verificationInsights: posts.slice(0, 6).map((post) => ({
          id: post.id,
          title: post.title || post.body?.slice(0, 80) || "Community post",
          confidence: Math.round(Number(post.confidenceScore ?? 0)),
          verificationStatus: String(post.verificationStatus),
          communityId: post.communityId,
          communityName: post.community.name,
        })),
        communitiesTracked: communities,
        windowDays,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  private communityScopeWhere(actor: JwtPayload, scopedCommunity: { id: string; country: string; state: string | null; lga: string | null } | null) {
    const where: Record<string, unknown> = { status: "Active" };
    if (scopedCommunity) where.id = scopedCommunity.id;
    else if (actor.typ === "admin" && actor.role !== "Super Admin") {
      where.country = actor.country;
      where.state = actor.state;
      where.lga = actor.lga;
    }
    return where;
  }

  private incidentScopeWhere(
    actor: JwtPayload,
    scopedCommunity: { country: string; state: string | null; lga: string | null } | null,
    since: Date,
  ) {
    const where: Record<string, unknown> = { createdAt: { gte: since } };
    if (scopedCommunity) {
      where.country = scopedCommunity.country;
      if (scopedCommunity.state) where.state = scopedCommunity.state;
      if (scopedCommunity.lga) where.lga = scopedCommunity.lga;
    } else if (actor.typ === "admin" && actor.role !== "Super Admin") {
      where.country = actor.country;
      where.state = actor.state;
      where.lga = actor.lga;
    }
    return where;
  }
}
