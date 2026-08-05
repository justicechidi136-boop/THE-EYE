import { IncidentStatus } from "@the-eye/shared";
import { isActiveIncidentStatus, isTerminalIncidentStatus } from "../incidents/incident-lifecycle";

export const NOTIFICATION_SCHEMA_VERSION = 1 as const;

export type NotificationRouteType =
  | "OWN_ACTIVE_INCIDENT"
  | "OWN_INCIDENT_DETAILS"
  | "COMMUNITY_VERIFICATION"
  | "SYSTEM";

export interface NotificationRoutingV1 {
  schemaVersion: typeof NOTIFICATION_SCHEMA_VERSION;
  routeType: NotificationRouteType;
  incidentId?: string;
  status?: string;
  notificationType: string;
  destination: string;
}

const TERMINAL_REPORTER_STATUSES = new Set<IncidentStatus>([
  IncidentStatus.Resolved,
  IncidentStatus.Closed,
  IncidentStatus.CancelledByReporter,
  IncidentStatus.FalseReport,
  IncidentStatus.ExpiredAfterReview,
]);

export function resolveReporterNotificationRouting(input: {
  incidentId: string;
  status: IncidentStatus | string;
  notificationType: string;
}): NotificationRoutingV1 {
  const status = input.status as IncidentStatus;
  const terminal =
    isTerminalIncidentStatus(status) || TERMINAL_REPORTER_STATUSES.has(status);
  const routeType: NotificationRouteType = terminal
    ? "OWN_INCIDENT_DETAILS"
    : "OWN_ACTIVE_INCIDENT";
  const destination = terminal ? "/incident-detail" : "/active-emergency";
  return {
    schemaVersion: NOTIFICATION_SCHEMA_VERSION,
    routeType,
    incidentId: input.incidentId,
    status: String(status),
    notificationType: input.notificationType,
    destination,
  };
}

export function buildReporterNotificationMetadata(input: {
  incidentId: string;
  status: IncidentStatus | string;
  notificationType: string;
  silent?: boolean;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const routing = resolveReporterNotificationRouting(input);
  return {
    ...routing,
    route: routing.destination,
    deepLink: routing.destination,
    silent: input.silent === true,
    ...(input.extra ?? {}),
  };
}

export function resolveNotificationRoutingFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  fallback: {
    incidentId?: string | null;
    status?: string | null;
    notificationType: string;
  },
): NotificationRoutingV1 {
  const meta = metadata ?? {};
  if (meta.schemaVersion === NOTIFICATION_SCHEMA_VERSION && typeof meta.destination === "string") {
    return {
      schemaVersion: NOTIFICATION_SCHEMA_VERSION,
      routeType: (meta.routeType as NotificationRouteType) ?? "SYSTEM",
      incidentId:
        (typeof meta.incidentId === "string" ? meta.incidentId : undefined) ??
        fallback.incidentId ??
        undefined,
      status:
        (typeof meta.status === "string" ? meta.status : undefined) ??
        fallback.status ??
        undefined,
      notificationType:
        (typeof meta.notificationType === "string"
          ? meta.notificationType
          : undefined) ?? fallback.notificationType,
      destination: meta.destination,
    };
  }

  if (fallback.incidentId) {
    return resolveReporterNotificationRouting({
      incidentId: fallback.incidentId,
      status: fallback.status ?? IncidentStatus.Received,
      notificationType: fallback.notificationType,
    });
  }

  return {
    schemaVersion: NOTIFICATION_SCHEMA_VERSION,
    routeType: "SYSTEM",
    notificationType: fallback.notificationType,
    destination: "/notifications",
  };
}

export function isActiveReporterIncidentStatus(status?: string | null): boolean {
  if (!status) return true;
  return isActiveIncidentStatus(status as IncidentStatus);
}
