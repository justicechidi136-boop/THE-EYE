import { Injectable } from "@nestjs/common";
import { AdminRoleName } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { PrismaService } from "../prisma/prisma.service";

export type TimelineAudience = "citizen" | "responder" | "dispatcher";

@Injectable()
export class IncidentTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async buildTimeline(incidentId: string, audience: TimelineAudience, actor?: JwtPayload) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        timeline: { orderBy: { createdAt: "asc" } },
        statusHistory: { orderBy: { createdAt: "asc" } },
        verifications: { orderBy: { createdAt: "asc" } },
        media: true,
        assignedAgency: true,
      },
    });
    if (!incident) return { data: [] };

    const assignments = await (this.prisma as any).incidentAssignment.findMany({
      where: { incidentId },
      include: { responder: true, agency: true },
      orderBy: { createdAt: "asc" },
    });
    const dispatchEvents = await (this.prisma as any).dispatchEvent.findMany({
      where: { incidentId },
      orderBy: { createdAt: "asc" },
    });

    const metadata = (incident.metadata ?? {}) as Record<string, unknown>;
    const triage = metadata.triage as Record<string, unknown> | undefined;
    const silent = metadata.silent === true;
    const labelFor = (defaultLabel: string, discreetLabel: string) =>
      audience === "citizen" && silent ? discreetLabel : defaultLabel;
    const entries: Array<Record<string, unknown>> = [];

    entries.push({
      at: incident.submittedAt,
      type: "report.submitted",
      label: labelFor("Emergency report submitted", "Status update received"),
      audience: ["citizen", "responder", "dispatcher"],
    });

    if (triage) {
      entries.push({
        at: metadata.triagedAt ?? incident.updatedAt,
        type: "triage.completed",
        label: audience === "dispatcher" ? `Triage: ${String(triage.priority ?? "")}` : labelFor("Incident triaged", "Status updated"),
        details: audience === "dispatcher" ? triage : undefined,
        audience: ["citizen", "responder", "dispatcher"],
      });
    }

    for (const verification of incident.verifications) {
      entries.push({
        at: verification.createdAt,
        type: "verification.updated",
        label: audience === "citizen" ? "Verification in progress" : `Verification ${verification.result}`,
        audience: audience === "citizen" ? ["citizen", "dispatcher"] : ["citizen", "responder", "dispatcher"],
      });
    }

    for (const assignment of assignments) {
      entries.push({
        at: assignment.createdAt,
        type: "assignment.created",
        label: labelFor("Responder assigned", "Agency assigned"),
        details:
          audience === "dispatcher"
            ? { agency: assignment.agency?.name, responder: assignment.responder?.displayName, status: assignment.status }
            : audience === "responder"
              ? { status: assignment.status }
              : { agency: assignment.agency?.name ?? "Assigned agency" },
        audience: ["citizen", "responder", "dispatcher"],
      });
      if (assignment.acceptedAt) {
        entries.push({ at: assignment.acceptedAt, type: "assignment.accepted", label: labelFor("Responder accepted", "Response accepted"), audience: ["citizen", "responder", "dispatcher"] });
      }
      if (assignment.enRouteAt) {
        entries.push({ at: assignment.enRouteAt, type: "assignment.en_route", label: labelFor("Responder en route", "Response en route"), audience: ["citizen", "responder", "dispatcher"] });
      }
      if (assignment.arrivedAt) {
        entries.push({ at: assignment.arrivedAt, type: "assignment.arrived", label: labelFor("Responder arrived", "Response arrived"), audience: ["citizen", "responder", "dispatcher"] });
      }
      if (assignment.completedAt) {
        entries.push({ at: assignment.completedAt, type: "assignment.completed", label: "Response completed", audience: ["citizen", "responder", "dispatcher"] });
      }
    }

    for (const event of dispatchEvents) {
      if (String(event.eventType).includes("note") && audience !== "dispatcher") continue;
      entries.push({
        at: event.createdAt,
        type: event.eventType,
        label: event.message ?? event.eventType,
        details: audience === "dispatcher" ? event.metadata : undefined,
        audience: String(event.eventType).includes("note") ? ["dispatcher"] : ["citizen", "responder", "dispatcher"],
      });
    }

    for (const item of incident.timeline) {
      if (String(item.eventType).includes("internal") && audience !== "dispatcher") continue;
      const itemMetadata = (item.metadata ?? {}) as Record<string, unknown>;
      const mediaId = typeof itemMetadata.mediaId === "string" ? itemMetadata.mediaId : undefined;
      const linkedMedia = mediaId ? incident.media.find((media) => media.id === mediaId) : undefined;
      entries.push({
        at: item.createdAt,
        type: item.eventType,
        label: item.message ?? item.eventType,
        details: linkedMedia
          ? {
              media: {
                id: linkedMedia.id,
                mediaType: linkedMedia.mediaType,
                contentType: linkedMedia.contentType,
                durationSeconds: linkedMedia.durationSeconds,
                transcriptionStatus: linkedMedia.transcriptionStatus,
                transcript: linkedMedia.transcript,
                translatedTranscript: linkedMedia.translatedTranscript,
                selectedLanguage: linkedMedia.selectedLanguage,
                detectedLanguage: linkedMedia.detectedLanguage,
                transcriptionConfidence: linkedMedia.transcriptionConfidence,
                uploadedAt: linkedMedia.uploadedAt,
              },
            }
          : audience === "dispatcher"
            ? itemMetadata
            : undefined,
        audience: String(item.eventType).includes("internal") ? ["dispatcher"] : ["citizen", "responder", "dispatcher"],
      });
    }

    const timelineMediaIds = new Set(
      incident.timeline
        .map((item) => ((item.metadata ?? {}) as Record<string, unknown>).mediaId)
        .filter((value): value is string => typeof value === "string"),
    );
    for (const media of incident.media.filter((item) => !timelineMediaIds.has(item.id))) {
      entries.push({
        at: media.uploadedAt ?? incident.submittedAt,
        type: "incident.media_attached",
        label: media.mediaType === "Audio" ? "Voice note attached" : `${media.mediaType} evidence attached`,
        details: {
          media: {
            id: media.id,
            mediaType: media.mediaType,
            contentType: media.contentType,
            durationSeconds: media.durationSeconds,
            transcriptionStatus: media.transcriptionStatus,
            transcript: media.transcript,
            translatedTranscript: media.translatedTranscript,
            selectedLanguage: media.selectedLanguage,
            detectedLanguage: media.detectedLanguage,
            transcriptionConfidence: media.transcriptionConfidence,
            uploadedAt: media.uploadedAt,
          },
        },
        audience: ["dispatcher", "responder"],
      });
    }

    if (incident.resolvedAt) {
      entries.push({ at: incident.resolvedAt, type: "incident.resolved", label: labelFor("Incident resolved", "Status closed"), audience: ["citizen", "responder", "dispatcher"] });
    }
    if (incident.closedAt) {
      entries.push({ at: incident.closedAt, type: "incident.closed", label: "Incident closed", audience: ["dispatcher"] });
    }

    const filtered = entries
      .filter((entry) => (entry.audience as string[]).includes(audience))
      .map(({ audience: _aud, ...rest }) => rest)
      .sort((a, b) => new Date(String(a.at)).getTime() - new Date(String(b.at)).getTime());

    if (silent && audience === "dispatcher") {
      filtered.unshift({ at: incident.submittedAt, type: "report.silent", label: "Silent SOS indicator", silent: true });
    }

    if (incident.isAnonymous && audience !== "dispatcher" && actor?.role !== AdminRoleName.SuperAdmin) {
      return {
        data: filtered.map((entry) => ({
          ...entry,
          details: undefined,
        })),
      };
    }

    return { data: filtered };
  }
}
