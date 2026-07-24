import { Injectable } from "@nestjs/common";
import { IncidentStatus } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  JurisdictionResolutionService,
  JurisdictionResolutionStatus,
  type ResolvedJurisdiction,
} from "./jurisdiction-resolution.service";

export type ImprovedLocationInput = {
  latitude: number;
  longitude: number;
  quality?: string;
  source?: string;
  accuracyMeters?: number;
  capturedAt?: Date;
};

export type JurisdictionCorrectionResult = {
  applied: boolean;
  locationUpdated: boolean;
  jurisdictionUpdated: boolean;
  requiresDispatcherReview: boolean;
  previousJurisdictionId?: string;
  nextJurisdictionId?: string;
  reason: string;
};

const TERMINAL_STATUSES = new Set<string>([
  IncidentStatus.Resolved,
  IncidentStatus.Closed,
  IncidentStatus.FalseReport,
]);

const AUTO_CORRECTABLE_PRIOR = new Set<string>([
  JurisdictionResolutionStatus.LocationUnavailable,
  JurisdictionResolutionStatus.ResolvedByProfileFallback,
  JurisdictionResolutionStatus.AwaitingManualResolution,
  JurisdictionResolutionStatus.OutsideSupportedJurisdiction,
]);

const HIGH_CONFIDENCE_QUALITIES = new Set(["precise", "acceptable"]);

@Injectable()
export class JurisdictionCorrectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jurisdictionResolution: JurisdictionResolutionService,
    private readonly audit: AuditService,
  ) {}

  async evaluateImprovedLocation(
    incidentId: string,
    input: ImprovedLocationInput,
    actor?: JwtPayload,
  ): Promise<JurisdictionCorrectionResult> {
    if (!this.jurisdictionResolution.isValidCoordinate(input.latitude, input.longitude)) {
      return {
        applied: false,
        locationUpdated: false,
        jurisdictionUpdated: false,
        requiresDispatcherReview: false,
        reason: "invalid_coordinates",
      };
    }

    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: {
        id: true,
        status: true,
        jurisdictionId: true,
        country: true,
        state: true,
        lga: true,
        metadata: true,
      },
    });
    if (!incident) {
      return {
        applied: false,
        locationUpdated: false,
        jurisdictionUpdated: false,
        requiresDispatcherReview: false,
        reason: "incident_not_found",
      };
    }
    if (TERMINAL_STATUSES.has(String(incident.status))) {
      return {
        applied: false,
        locationUpdated: false,
        jurisdictionUpdated: false,
        requiresDispatcherReview: false,
        reason: "terminal_incident",
      };
    }

    const metadata = (incident.metadata as Record<string, unknown>) ?? {};
    const previousResolutionStatus = String(metadata.jurisdictionResolutionStatus ?? "");
    const previousResolutionSource = String(metadata.jurisdictionResolutionSource ?? "");
    const previousJurisdictionId = incident.jurisdictionId;

    const proposed = await this.jurisdictionResolution.resolve({
      latitude: input.latitude,
      longitude: input.longitude,
      actor,
    });

    const sameJurisdiction = proposed.id === previousJurisdictionId;
    if (sameJurisdiction) {
      return {
        applied: true,
        locationUpdated: true,
        jurisdictionUpdated: false,
        requiresDispatcherReview: false,
        previousJurisdictionId,
        nextJurisdictionId: proposed.id,
        reason: "location_only_same_jurisdiction",
      };
    }

    const canAutoCorrectPrior = AUTO_CORRECTABLE_PRIOR.has(previousResolutionStatus);
    const highConfidence = !input.quality || HIGH_CONFIDENCE_QUALITIES.has(input.quality);
    const sameCountry = proposed.country === incident.country;

    if (canAutoCorrectPrior && highConfidence && sameCountry) {
      await this.applyJurisdictionCorrection(incidentId, proposed, metadata, {
        previousJurisdictionId,
        previousResolutionStatus,
        previousResolutionSource,
        input,
        actor,
        reason: "auto_correct_from_improved_gps",
      });
      return {
        applied: true,
        locationUpdated: true,
        jurisdictionUpdated: true,
        requiresDispatcherReview: false,
        previousJurisdictionId,
        nextJurisdictionId: proposed.id,
        reason: "auto_correct_from_improved_gps",
      };
    }

    if (
      previousResolutionStatus === JurisdictionResolutionStatus.ResolvedByCoordinates &&
      !sameJurisdiction
    ) {
      await this.flagDispatcherReview(incidentId, metadata, {
        previousJurisdictionId,
        proposed,
        previousResolutionStatus,
        previousResolutionSource,
        input,
      });
      return {
        applied: true,
        locationUpdated: true,
        jurisdictionUpdated: false,
        requiresDispatcherReview: true,
        previousJurisdictionId,
        nextJurisdictionId: proposed.id,
        reason: "cross_jurisdiction_requires_dispatcher_review",
      };
    }

    if (canAutoCorrectPrior && sameCountry) {
      await this.applyJurisdictionCorrection(incidentId, proposed, metadata, {
        previousJurisdictionId,
        previousResolutionStatus,
        previousResolutionSource,
        input,
        actor,
        reason: "fallback_jurisdiction_corrected",
      });
      return {
        applied: true,
        locationUpdated: true,
        jurisdictionUpdated: true,
        requiresDispatcherReview: false,
        previousJurisdictionId,
        nextJurisdictionId: proposed.id,
        reason: "fallback_jurisdiction_corrected",
      };
    }

    return {
      applied: true,
      locationUpdated: true,
      jurisdictionUpdated: false,
      requiresDispatcherReview: true,
      previousJurisdictionId,
      nextJurisdictionId: proposed.id,
      reason: "jurisdiction_change_not_auto_applied",
    };
  }

  private async applyJurisdictionCorrection(
    incidentId: string,
    proposed: ResolvedJurisdiction,
    metadata: Record<string, unknown>,
    context: {
      previousJurisdictionId: string;
      previousResolutionStatus: string;
      previousResolutionSource: string;
      input: ImprovedLocationInput;
      actor?: JwtPayload;
      reason: string;
    },
  ) {
    await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        jurisdictionId: proposed.id,
        country: proposed.country,
        state: proposed.state,
        lga: proposed.lga,
        metadata: {
          ...metadata,
          jurisdictionResolutionStatus: proposed.resolutionStatus,
          jurisdictionResolutionSource: proposed.resolutionSource,
          jurisdictionCorrection: {
            previousJurisdictionId: context.previousJurisdictionId,
            nextJurisdictionId: proposed.id,
            previousResolutionStatus: context.previousResolutionStatus,
            previousResolutionSource: context.previousResolutionSource,
            nextResolutionStatus: proposed.resolutionStatus,
            nextResolutionSource: proposed.resolutionSource,
            locationQuality: context.input.quality ?? null,
            locationSource: context.input.source ?? null,
            reason: context.reason,
            correctedAt: new Date().toISOString(),
          },
        },
      } as never,
    });

    await this.audit.record({
      actor: context.actor,
      actorType: context.actor?.typ ?? "system",
      action: "incident.jurisdiction_corrected",
      entityType: "incidents",
      entityId: incidentId,
      beforeState: {
        jurisdictionId: context.previousJurisdictionId,
        resolutionStatus: context.previousResolutionStatus,
        resolutionSource: context.previousResolutionSource,
      },
      afterState: {
        jurisdictionId: proposed.id,
        resolutionStatus: proposed.resolutionStatus,
        resolutionSource: proposed.resolutionSource,
      },
      metadata: {
        reason: context.reason,
        locationQuality: context.input.quality ?? null,
        locationSource: context.input.source ?? null,
      },
    });
  }

  private async flagDispatcherReview(
    incidentId: string,
    metadata: Record<string, unknown>,
    context: {
      previousJurisdictionId: string;
      proposed: ResolvedJurisdiction;
      previousResolutionStatus: string;
      previousResolutionSource: string;
      input: ImprovedLocationInput;
    },
  ) {
    await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        metadata: {
          ...metadata,
          jurisdictionCorrectionPending: {
            previousJurisdictionId: context.previousJurisdictionId,
            proposedJurisdictionId: context.proposed.id,
            previousResolutionStatus: context.previousResolutionStatus,
            previousResolutionSource: context.previousResolutionSource,
            proposedResolutionStatus: context.proposed.resolutionStatus,
            proposedResolutionSource: context.proposed.resolutionSource,
            locationQuality: context.input.quality ?? null,
            locationSource: context.input.source ?? null,
            flaggedAt: new Date().toISOString(),
          },
        },
      } as never,
    });
  }
}
