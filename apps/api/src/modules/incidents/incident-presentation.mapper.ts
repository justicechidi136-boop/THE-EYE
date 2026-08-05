import {
  IncidentAssignmentStatus,
  IncidentStatus,
  ResolutionSource,
} from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import {
  canReporterCancelDirectly,
  canReporterRequestCancellation,
  isActiveIncidentStatus,
  isTerminalIncidentStatus,
} from "./incident-lifecycle";

export type ProgressStageState = "pending" | "current" | "complete" | "skipped";

export interface IncidentProgressStage {
  key: string;
  label: string;
  state: ProgressStageState;
  completedAt?: string;
}

export interface IncidentAllowedActions {
  addEvidence: boolean;
  cancel: boolean;
  requestCancellation: boolean;
  confirmResolved: boolean;
  confirmStillOngoing: boolean;
  addWrittenUpdate: boolean;
  updateLocation: boolean;
  retryLiveVideo: boolean;
}

export interface IncidentPresentation {
  status: IncidentStatus;
  displayLabel: string;
  isTerminal: boolean;
  isActive: boolean;
  progressStep: number;
  progressStages: IncidentProgressStage[];
  allowedActions: IncidentAllowedActions;
  resolutionSummary?: {
    source?: ResolutionSource;
    reason?: string;
    resolvedAt?: string;
  };
  cancellationSummary?: {
    status: "none" | "requested" | "cancelled";
    reason?: string;
    requestedAt?: string;
    cancelledAt?: string;
  };
}

const PROGRESS_DEFINITION: Array<{ key: string; label: string; statuses: IncidentStatus[] }> = [
  { key: "submitted", label: "Submitted", statuses: [IncidentStatus.Submitted] },
  { key: "received", label: "Received", statuses: [IncidentStatus.Received] },
  { key: "verifying", label: "Verifying", statuses: [IncidentStatus.Verifying] },
  { key: "verified", label: "Verified", statuses: [IncidentStatus.Verified] },
  {
    key: "agencyAssigned",
    label: "Agency assigned",
    statuses: [IncidentStatus.Assigned, IncidentStatus.CancellationRequested],
  },
  {
    key: "respondersEnRoute",
    label: "Responders en route",
    statuses: [IncidentStatus.Responding],
  },
  {
    key: "underControl",
    label: "Under control",
    statuses: [IncidentStatus.UnderControl],
  },
  { key: "resolved", label: "Resolved", statuses: [IncidentStatus.Resolved] },
  { key: "closed", label: "Closed", statuses: [IncidentStatus.Closed] },
];

const DISPLAY_LABELS: Record<IncidentStatus, string> = {
  [IncidentStatus.Submitted]: "Report submitted",
  [IncidentStatus.Received]: "Report received",
  [IncidentStatus.Verifying]: "Verifying report",
  [IncidentStatus.Verified]: "Report verified",
  [IncidentStatus.Assigned]: "Agency assigned",
  [IncidentStatus.Responding]: "Responders en route",
  [IncidentStatus.UnderControl]: "Situation under control",
  [IncidentStatus.CancellationRequested]: "Cancellation under review",
  [IncidentStatus.Resolved]: "Resolved",
  [IncidentStatus.Closed]: "Closed",
  [IncidentStatus.FalseReport]: "Marked as invalid",
  [IncidentStatus.CancelledByReporter]: "Cancelled by reporter",
  [IncidentStatus.ExpiredAfterReview]: "Expired after review",
};

function statusIndex(status: IncidentStatus): number {
  const order = [
    IncidentStatus.Submitted,
    IncidentStatus.Received,
    IncidentStatus.Verifying,
    IncidentStatus.Verified,
    IncidentStatus.Assigned,
    IncidentStatus.CancellationRequested,
    IncidentStatus.Responding,
    IncidentStatus.UnderControl,
    IncidentStatus.Resolved,
    IncidentStatus.Closed,
    IncidentStatus.CancelledByReporter,
    IncidentStatus.FalseReport,
    IncidentStatus.ExpiredAfterReview,
  ];
  return order.indexOf(status);
}

function deriveProgressStages(
  status: IncidentStatus,
  statusHistory: Array<{ toStatus: string; createdAt: Date }>,
): IncidentProgressStage[] {
  const currentIdx = statusIndex(status);
  const completionByKey = new Map<string, string>();
  for (const entry of statusHistory) {
    const stage = PROGRESS_DEFINITION.find((def) =>
      def.statuses.includes(entry.toStatus as IncidentStatus),
    );
    if (stage) {
      completionByKey.set(stage.key, entry.createdAt.toISOString());
    }
  }

  return PROGRESS_DEFINITION.map((def) => {
    const defIdx = Math.max(
      ...def.statuses.map((s) => statusIndex(s)).filter((i) => i >= 0),
    );
    let state: ProgressStageState = "pending";
    if (def.statuses.includes(status)) {
      state = "current";
    } else if (defIdx >= 0 && defIdx < currentIdx) {
      state = "complete";
    } else if (
      status === IncidentStatus.CancelledByReporter ||
      status === IncidentStatus.FalseReport ||
      status === IncidentStatus.ExpiredAfterReview
    ) {
      state = "skipped";
    }
    return {
      key: def.key,
      label: def.label,
      state,
      completedAt: completionByKey.get(def.key),
    };
  });
}

function deriveAllowedActions(
  incident: {
    status: IncidentStatus;
    reporterId?: string | null;
    cancellationRequestedAt?: Date | null;
  },
  actor: JwtPayload | undefined,
  activeAssignment?: { status: IncidentAssignmentStatus } | null,
): IncidentAllowedActions {
  const isReporter = actor?.typ === "user" && incident.reporterId === actor.sub;
  const status = incident.status as IncidentStatus;
  const hasActiveAssignment =
    activeAssignment != null &&
    activeAssignment.status !== IncidentAssignmentStatus.Completed &&
    activeAssignment.status !== IncidentAssignmentStatus.Cancelled &&
    activeAssignment.status !== IncidentAssignmentStatus.Declined;

  const active = isActiveIncidentStatus(status);
  return {
    addEvidence: active && isReporter,
    cancel: active && isReporter && canReporterCancelDirectly(status),
    requestCancellation:
      active &&
      isReporter &&
      canReporterRequestCancellation(status) &&
      !incident.cancellationRequestedAt,
    confirmResolved:
      active &&
      isReporter &&
      (status === IncidentStatus.UnderControl ||
        status === IncidentStatus.Responding) &&
      hasActiveAssignment,
    confirmStillOngoing:
      active &&
      isReporter &&
      (status === IncidentStatus.UnderControl ||
        status === IncidentStatus.Responding ||
        status === IncidentStatus.Assigned) &&
      hasActiveAssignment,
    addWrittenUpdate: active && isReporter,
    updateLocation: active && isReporter,
    retryLiveVideo: active && isReporter,
  };
}

export function buildIncidentPresentation(
  incident: {
    status: IncidentStatus;
    reporterId?: string | null;
    resolutionSource?: ResolutionSource | null;
    resolutionReason?: string | null;
    resolvedAt?: Date | null;
    cancellationReason?: string | null;
    cancellationRequestedAt?: Date | null;
    cancelledAt?: Date | null;
    statusHistory?: Array<{ toStatus: string; createdAt: Date }>;
  },
  actor: JwtPayload | undefined,
  activeAssignment?: { status: IncidentAssignmentStatus } | null,
): IncidentPresentation {
  const status = incident.status as IncidentStatus;
  const history = incident.statusHistory ?? [];
  const progressStages = deriveProgressStages(status, history);
  const currentStage = progressStages.find((s) => s.state === "current");
  const progressStep = currentStage
    ? progressStages.indexOf(currentStage) + 1
    : progressStages.filter((s) => s.state === "complete").length;

  let cancellationSummary: IncidentPresentation["cancellationSummary"] = {
    status: "none",
  };
  if (status === IncidentStatus.CancelledByReporter) {
    cancellationSummary = {
      status: "cancelled",
      reason: incident.cancellationReason ?? undefined,
      cancelledAt: incident.cancelledAt?.toISOString(),
    };
  } else if (
    status === IncidentStatus.CancellationRequested ||
    incident.cancellationRequestedAt
  ) {
    cancellationSummary = {
      status: "requested",
      reason: incident.cancellationReason ?? undefined,
      requestedAt: incident.cancellationRequestedAt?.toISOString(),
    };
  }

  return {
    status,
    displayLabel: DISPLAY_LABELS[status] ?? status,
    isTerminal: isTerminalIncidentStatus(status),
    isActive: isActiveIncidentStatus(status),
    progressStep,
    progressStages,
    allowedActions: deriveAllowedActions(incident, actor, activeAssignment),
    resolutionSummary:
      incident.resolvedAt || incident.resolutionSource
        ? {
            source: incident.resolutionSource ?? undefined,
            reason: incident.resolutionReason ?? undefined,
            resolvedAt: incident.resolvedAt?.toISOString(),
          }
        : undefined,
    cancellationSummary,
  };
}

export const TERMINAL_ROUTE_TYPE = "INCIDENT_DETAILS" as const;
