import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class VoiceAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [incidentMedia, postMedia, commentMedia] = await Promise.all([
      this.prisma.incidentMedia.findMany({
        where: { mediaType: "Audio", deletedAt: null },
        select: {
          transcriptionStatus: true,
          moderationStatus: true,
          selectedLanguage: true,
          detectedLanguage: true,
          translatedTranscript: true,
          transcriptionConfidence: true,
        },
      }),
      this.prisma.communityPostMedia.findMany({
        where: { mediaType: "Audio", deletedAt: null },
        select: {
          transcriptionStatus: true,
          moderationStatus: true,
          selectedLanguage: true,
          detectedLanguage: true,
          translatedTranscript: true,
          transcriptionConfidence: true,
        },
      }),
      this.prisma.communityCommentMedia.findMany({
        where: { mediaType: "Audio", deletedAt: null },
        select: {
          transcriptionStatus: true,
          moderationStatus: true,
          selectedLanguage: true,
          detectedLanguage: true,
          translatedTranscript: true,
          transcriptionConfidence: true,
        },
      }),
    ]);

    const rows = [
      ...incidentMedia.map((row) => ({ ...row, resourceType: "incident_media" as const })),
      ...postMedia.map((row) => ({ ...row, resourceType: "community_post_media" as const })),
      ...commentMedia.map((row) => ({ ...row, resourceType: "community_comment_media" as const })),
    ];

    const transcriptionStatusCounts = countBy(rows, (row) => row.transcriptionStatus ?? "Unknown");
    const moderationStatusCounts = countBy(rows, (row) => row.moderationStatus ?? "Pending");
    const selectedLanguageCounts = countBy(rows, (row) => row.selectedLanguage ?? "auto");
    const resourceTypeCounts = countBy(rows, (row) => row.resourceType);

    const translatedCount = rows.filter((row) => !!row.translatedTranscript?.trim()).length;
    const lowConfidenceCount = rows.filter((row) => row.transcriptionStatus === "LowConfidence").length;
    const confidences = rows
      .map((row) => (row.transcriptionConfidence != null ? Number(row.transcriptionConfidence) : null))
      .filter((value): value is number => value != null);
    const averageTranscriptionConfidence = confidences.length
      ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
      : null;

    return {
      totalVoiceAttachments: rows.length,
      translatedCount,
      lowConfidenceCount,
      averageTranscriptionConfidence,
      transcriptionStatusCounts,
      moderationStatusCounts,
      selectedLanguageCounts,
      resourceTypeCounts,
    };
  }
}

function countBy<T>(items: T[], selector: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = selector(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}
