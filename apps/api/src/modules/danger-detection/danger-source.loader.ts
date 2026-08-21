import { Injectable } from "@nestjs/common";
import type { DangerSourceType } from "@the-eye/shared";
import { PrismaService } from "../prisma/prisma.service";

const SAFETY_POST_TYPES = new Set([
  "SuspiciousActivity", "LostChild", "MissingPerson", "CrimeAlert", "AccidentAlert",
  "FireAlert", "FloodWarning", "LocalWarning", "RoadHazard", "PatrolUpdate",
]);

export type LoadedDangerSource = {
  sourceType: DangerSourceType;
  sourceId: string;
  text: string;
  sourceLocale?: string;
  incidentId?: string;
  speechArtifactId?: string;
  latitude?: number;
  longitude?: number;
  occurredAt?: Date;
};

@Injectable()
export class DangerSourceLoader {
  constructor(private readonly prisma: PrismaService) {}

  async load(sourceType: DangerSourceType, sourceId: string): Promise<LoadedDangerSource | null> {
    const prisma = this.prisma as any;
    if (sourceType === "INCIDENT") {
      const row = await prisma.incident.findUnique({ where: { id: sourceId } });
      if (!row) return null;
      return this.result(sourceType, sourceId, [row.title, row.description, row.address], row, row.id);
    }
    if (sourceType === "COMMUNITY_POST") {
      const row = await prisma.communityPost.findUnique({ where: { id: sourceId } });
      if (!row || !SAFETY_POST_TYPES.has(String(row.type))) return null;
      return this.result(sourceType, sourceId, [row.title, row.body], row, row.incidentId ?? undefined);
    }
    if (sourceType === "COMMUNITY_COMMENT") {
      const row = await prisma.communityPostComment.findUnique({ where: { id: sourceId }, include: { post: true } });
      if (!row || !row.post || !SAFETY_POST_TYPES.has(String(row.post.type)) || !row.body?.trim()) return null;
      return this.result(sourceType, sourceId, [row.body], row.post, row.post.incidentId ?? undefined, row.createdAt);
    }
    if (sourceType === "BROADCAST_SIGHTING") {
      const row = await prisma.broadcastSighting.findUnique({ where: { id: sourceId }, include: { broadcast: true } });
      if (!row) return null;
      return this.result(sourceType, sourceId, [row.description, row.approximateArea, row.directionOfTravel], row, row.broadcast?.incidentId, row.observedAt ?? row.createdAt);
    }
    return this.loadAudio(sourceType, sourceId);
  }

  private async loadAudio(sourceType: DangerSourceType, sourceId: string): Promise<LoadedDangerSource | null> {
    const prisma = this.prisma as any;
    const speechType = sourceType === "INCIDENT_AUDIO" ? "incident_media" : sourceType === "COMMUNITY_POST_AUDIO" ? "community_post_media" : "broadcast_media";
    const artifact = await prisma.speechArtifact.findUnique({
      where: { sourceType_sourceId_provenance: { sourceType: speechType, sourceId, provenance: "TRANSCRIPT" } },
    });
    if (!artifact || artifact.status !== "COMPLETED" || !artifact.content?.trim()) return null;
    if (sourceType === "INCIDENT_AUDIO") {
      const media = await prisma.incidentMedia.findUnique({ where: { id: sourceId }, include: { incident: true } });
      if (!media || media.deletedAt) return null;
      return this.result(sourceType, sourceId, [artifact.content], media.incident, media.incidentId, media.createdAt, artifact);
    }
    if (sourceType === "COMMUNITY_POST_AUDIO") {
      const media = await prisma.communityPostMedia.findUnique({ where: { id: sourceId }, include: { post: true } });
      if (!media || media.deletedAt || !SAFETY_POST_TYPES.has(String(media.post?.type))) return null;
      return this.result(sourceType, sourceId, [artifact.content], media.post, media.post?.incidentId, media.createdAt, artifact);
    }
    const media = await prisma.broadcastMedia.findUnique({ where: { id: sourceId }, include: { sighting: { include: { broadcast: true } } } });
    if (!media || media.deletedAt || !media.sighting) return null;
    return this.result(sourceType, sourceId, [artifact.content], media.sighting, media.sighting.broadcast?.incidentId, media.createdAt, artifact);
  }

  private result(
    sourceType: DangerSourceType,
    sourceId: string,
    parts: unknown[],
    location: any,
    incidentId?: string,
    occurredAt?: Date,
    artifact?: any,
  ): LoadedDangerSource | null {
    const text = parts.filter((part): part is string => typeof part === "string" && Boolean(part.trim())).join("\n").trim();
    if (!text) return null;
    const latitude = this.coordinate(location?.manualLatitude ?? location?.latitude, -90, 90);
    const longitude = this.coordinate(location?.manualLongitude ?? location?.longitude, -180, 180);
    return {
      sourceType,
      sourceId,
      text,
      sourceLocale: artifact?.sourceLocale ?? artifact?.detectedLocale ?? undefined,
      incidentId,
      speechArtifactId: artifact?.id,
      latitude,
      longitude,
      occurredAt: occurredAt ?? location?.occurredAt ?? location?.createdAt,
    };
  }

  private coordinate(value: unknown, min: number, max: number) {
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max ? number : undefined;
  }
}
