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
    const entries: Array<Record<string, unknown>> = [];

    entries.push({
      at: incident.submittedAt,
      type: "report.submitted",
      label: "Emergency report submitted",
      audience: ["citizen", "responder", "dispatcher"],
    });

    if (triage) {
      entries.push({
        at: metadata.triagedAt ?? incident.updatedAt,
        type: "triage.completed",
        label: audience === "dispatcher" ? `Triage: ${String(triage.priority ?? "")}` : "Incident triaged",
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
        label: "Responder assigned",
        details:
          audience === "dispatcher"
            ? { agency: assignment.agency?.name, responder: assignment.responder?.displayName, status: assignment.status }
            : audience === "responder"
              ? { status: assignment.status }
              : { agency: assignment.agency?.name ?? "Assigned agency" },
        audience: ["citizen", "responder", "dispatcher"],
      });
      if (assignment.acceptedAt) {
        entries.push({ at: assignment.acceptedAt, type: "assignment.accepted", label: "Responder accepted", audience: ["citizen", "responder", "dispatcher"] });
      }
      if (assignment.enRouteAt) {
        entries.push({ at: assignment.enRouteAt, type: "assignment.en_route", label: "Responder en route", audience: ["citizen", "responder", "dispatcher"] });
      }
      if (assignment.arrivedAt) {
        entries.push({ at: assignment.arrivedAt, type: "assignment.arrived", label: "Responder arrived", audience: ["citizen", "responder", "dispatcher"] });
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
      entries.push({
        at: item.createdAt,
        type: item.eventType,
        label: item.message ?? item.eventType,
        audience: String(item.eventType).includes("internal") ? ["dispatcher"] : ["citizen", "responder", "dispatcher"],
      });
    }

    if (incident.media.length) {
      entries.push({
        at: incident.media[0]?.uploadedAt ?? incident.submittedAt,
        type: "evidence.uploaded",
        label: `${incident.media.length} evidence item(s) uploaded`,
        audience: ["dispatcher", "responder"],
      });
    }

    if (incident.resolvedAt) {
      entries.push({ at: incident.resolvedAt, type: "incident.resolved", label: "Incident resolved", audience: ["citizen", "responder", "dispatcher"] });
    }
    if (incident.closedAt) {
      entries.push({ at: incident.closedAt, type: "incident.closed", label: "Incident closed", audience: ["dispatcher"] });
    }

    const filtered = entries
      .filter((entry) => (entry.audience as string[]).includes(audience))
      .map(({ audience: _aud, ...rest }) => rest)
      .sort((a, b) => new Date(String(a.at)).getTime() - new Date(String(b.at)).getTime());

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
