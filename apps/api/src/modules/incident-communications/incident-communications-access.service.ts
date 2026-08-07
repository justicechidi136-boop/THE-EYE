import { Injectable, NotFoundException } from "@nestjs/common";
import { AdminRoleName } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { PrismaService } from "../prisma/prisma.service";

export type IncidentCommunicationRole =
  | "Reporter"
  | "Dispatcher"
  | "Agency"
  | "Responder"
  | "OversightAuditor"
  | "Denied";

export type IncidentCommunicationAccess = {
  role: IncidentCommunicationRole;
  canRead: boolean;
  canWrite: boolean;
  canReadInternal: boolean;
  canModerate: boolean;
  senderRole: string;
  senderAgencyId?: string;
  senderResponderId?: string;
  displayLabel: string;
  incident: {
    id: string;
    reporterId: string | null;
    status: string;
    assignedAgencyId: string | null;
    country: string;
    state: string;
    lga: string;
    metadata: Record<string, unknown>;
  };
};

const WRITE_ROLES = new Set<IncidentCommunicationRole>([
  "Reporter",
  "Dispatcher",
  "Agency",
  "Responder",
]);

const DISPATCHER_ROLES = new Set<string>([
  AdminRoleName.SuperAdmin,
  AdminRoleName.CountryAdmin,
  AdminRoleName.StateAdmin,
  AdminRoleName.LgaAdmin,
  AdminRoleName.CallCenterAgent,
]);

@Injectable()
export class IncidentCommunicationsAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertAccess(incidentId: string, actor: JwtPayload): Promise<IncidentCommunicationAccess> {
    const access = await this.resolveAccess(incidentId, actor);
    if (!access.canRead) {
      throw new NotFoundException("Incident not found or outside your scope");
    }
    return access;
  }

  async resolveAccess(incidentId: string, actor?: JwtPayload): Promise<IncidentCommunicationAccess> {
    const denied = (incident: IncidentCommunicationAccess["incident"]): IncidentCommunicationAccess => ({
      role: "Denied",
      canRead: false,
      canWrite: false,
      canReadInternal: false,
      canModerate: false,
      senderRole: "Denied",
      displayLabel: "Denied",
      incident,
    });

    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: {
        id: true,
        reporterId: true,
        status: true,
        assignedAgencyId: true,
        country: true,
        state: true,
        lga: true,
        metadata: true,
      },
    });
    if (!incident) {
      throw new NotFoundException("Incident not found or outside your scope");
    }

    const incidentView = {
      ...incident,
      metadata: (incident.metadata ?? {}) as Record<string, unknown>,
    };

    if (!actor) return denied(incidentView);

    if (actor.typ === "field") {
      return this.resolveFieldOfficerAccess(incidentView, actor);
    }

    if (actor.typ === "user" && actor.role === "responder") {
      return this.resolveResponderAccess(incidentView, actor);
    }

    if (actor.typ === "user") {
      if (incident.reporterId === actor.sub) {
        return {
          role: "Reporter",
          canRead: true,
          canWrite: true,
          canReadInternal: false,
          canModerate: false,
          senderRole: "Reporter",
          displayLabel: this.reporterDisplayLabel(incidentView),
          incident: incidentView,
        };
      }
      const verifierOnly = await this.isCommunityVerifierOnly(actor.sub, incidentId);
      if (verifierOnly) return denied(incidentView);
      return denied(incidentView);
    }

    if (actor.typ === "admin") {
      if (actor.role === AdminRoleName.OversightAuditor) {
        if (!this.adminInJurisdiction(actor, incidentView)) return denied(incidentView);
        return {
          role: "OversightAuditor",
          canRead: true,
          canWrite: false,
          canReadInternal: true,
          canModerate: false,
          senderRole: "OversightAuditor",
          displayLabel: "Oversight",
          incident: incidentView,
        };
      }

      if (actor.role === AdminRoleName.AgencyAdmin || actor.role === AdminRoleName.PoliceSecurityOfficer) {
        if (incident.assignedAgencyId !== actor.agencyId) return denied(incidentView);
        return {
          role: "Agency",
          canRead: true,
          canWrite: true,
          canReadInternal: true,
          canModerate: false,
          senderRole: "Agency",
          senderAgencyId: actor.agencyId ?? undefined,
          displayLabel: "Assigned agency",
          incident: incidentView,
        };
      }

      if (DISPATCHER_ROLES.has(actor.role)) {
        if (!this.adminInJurisdiction(actor, incidentView)) return denied(incidentView);
        return {
          role: "Dispatcher",
          canRead: true,
          canWrite: true,
          canReadInternal: true,
          canModerate: true,
          senderRole: "Dispatcher",
          displayLabel: "Dispatcher",
          incident: incidentView,
        };
      }
    }

    return denied(incidentView);
  }

  private async resolveFieldOfficerAccess(
    incident: IncidentCommunicationAccess["incident"],
    actor: JwtPayload,
  ): Promise<IncidentCommunicationAccess> {
    const assignment = await this.prisma.incidentAssignment.findFirst({
      where: {
        incidentId: incident.id,
        responder: { adminUserId: actor.sub },
        status: { in: ["Assigned", "Accepted", "EnRoute", "OnScene", "Active"] as never[] },
      },
      select: {
        id: true,
        responder: { select: { id: true, agencyId: true, displayName: true } },
      },
    });
    if (!assignment?.responder) {
      return {
        role: "Denied",
        canRead: false,
        canWrite: false,
        canReadInternal: false,
        canModerate: false,
        senderRole: "Denied",
        displayLabel: "Denied",
        incident,
      };
    }

    return {
      role: "Responder",
      canRead: true,
      canWrite: true,
      canReadInternal: false,
      canModerate: false,
      senderRole: "Responder",
      senderAgencyId: assignment.responder.agencyId ?? undefined,
      senderResponderId: assignment.responder.id,
      displayLabel: assignment.responder.displayName ?? "Field officer",
      incident,
    };
  }

  private async resolveResponderAccess(
    incident: IncidentCommunicationAccess["incident"],
    actor: JwtPayload,
  ): Promise<IncidentCommunicationAccess> {
    const responder = await this.prisma.responder.findFirst({
      where: { userId: actor.sub },
      select: { id: true, agencyId: true, displayName: true },
    });
    if (!responder) {
      return {
        role: "Denied",
        canRead: false,
        canWrite: false,
        canReadInternal: false,
        canModerate: false,
        senderRole: "Denied",
        displayLabel: "Denied",
        incident,
      };
    }

    const assignment = await this.prisma.incidentAssignment.findFirst({
      where: {
        incidentId: incident.id,
        responderId: responder.id,
        status: { in: ["Assigned", "Accepted", "EnRoute", "OnScene", "Active"] as never[] },
      },
      select: { id: true },
    });
    if (!assignment) {
      return {
        role: "Denied",
        canRead: false,
        canWrite: false,
        canReadInternal: false,
        canModerate: false,
        senderRole: "Denied",
        displayLabel: "Denied",
        incident,
      };
    }

    return {
      role: "Responder",
      canRead: true,
      canWrite: true,
      canReadInternal: false,
      canModerate: false,
      senderRole: "Responder",
      senderAgencyId: responder.agencyId ?? undefined,
      senderResponderId: responder.id,
      displayLabel: responder.displayName ?? "Responder",
      incident,
    };
  }

  private async isCommunityVerifierOnly(userId: string, incidentId: string) {
    const response = await this.prisma.communityVerificationResponse.findFirst({
      where: { userId, request: { incidentId } },
      select: { id: true },
    });
    return Boolean(response);
  }

  private adminInJurisdiction(
    actor: JwtPayload,
    incident: { country: string; state: string; lga: string },
  ) {
    if (actor.role === AdminRoleName.SuperAdmin) return true;
    if (actor.country && actor.country !== incident.country) return false;
    if (actor.role === AdminRoleName.CountryAdmin) return true;
    if (actor.state && actor.state !== incident.state) return false;
    if (actor.role === AdminRoleName.StateAdmin) return true;
    if (actor.lga && actor.lga !== incident.lga) return false;
    return true;
  }

  private reporterDisplayLabel(incident: { metadata: Record<string, unknown> }) {
    const mode = incident.metadata.reportingMode;
    if (mode === "anonymous") return "Reporter";
    return "You";
  }

  canSendMessageType(access: IncidentCommunicationAccess, messageType: string, official = false) {
    if (!access.canWrite || !WRITE_ROLES.has(access.role)) return false;
    if (official) return access.role !== "Reporter";
    if (access.role === "Reporter") {
      return ["Text", "Voice", "Image", "Video", "QuickReply", "LocationUpdate"].includes(messageType);
    }
    return [
      "Text",
      "Voice",
      "Image",
      "Video",
      "OfficialNotice",
      "SafetyInstruction",
      "InformationRequest",
      "SystemUpdate",
    ].includes(messageType);
  }
}
