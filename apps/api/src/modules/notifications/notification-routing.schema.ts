import { IncidentStatus } from "@the-eye/shared";
import { isActiveIncidentStatus, isTerminalIncidentStatus } from "../incidents/incident-lifecycle";

export const NOTIFICATION_SCHEMA_VERSION = 1 as const;

export type NotificationRouteType =
  | "OWN_ACTIVE_INCIDENT"
  | "OWN_INCIDENT_DETAILS"
  | "COMMUNITY_VERIFICATION"
  | "BROADCAST_DETAILS"
  | "FIELD_DEVICE_STATUS"
  | "FIELD_OPERATIONAL"
  | "NW_COMMUNITY_ALERT"
  | "NW_POST_ACTIVITY"
  | "NW_POST_COMMENT"
  | "NW_PATROL_INVITATION"
  | "NW_PATROL_UPDATE"
  | "NW_MEMBERSHIP_APPROVED"
  | "NW_MEMBERSHIP_REJECTED"
  | "NW_AREA_CHANGED"
  | "NW_ESCALATION_UPDATE"
  | "SYSTEM";

export interface NotificationRoutingV1 {
  schemaVersion: typeof NOTIFICATION_SCHEMA_VERSION;
  routeType: NotificationRouteType;
  incidentId?: string;
  verificationRequestId?: string;
  status?: string;
  notificationType: string;
  destination: string;
  broadcastId?: string;
  broadcastCategory?: string;
  countryCode?: string;
  issuedAt?: string;
  expiresAt?: string;
  eventType?: string;
  category?: string;
  distanceBand?: string;
  assignmentId?: string;
  backupRequestId?: string;
  safetyAlertId?: string;
  fieldDeviceId?: string;
  communityId?: string;
  postId?: string;
  patrolId?: string;
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

export function resolveBroadcastNotificationRouting(input: {
  broadcastId: string;
  broadcastCategory: string;
  countryCode: string;
  issuedAt: string;
  eventType: string;
}): NotificationRoutingV1 {
  return {
    schemaVersion: NOTIFICATION_SCHEMA_VERSION,
    routeType: "BROADCAST_DETAILS",
    notificationType: "BroadcastAlert",
    destination: `/broadcasts/${input.broadcastId}`,
    broadcastId: input.broadcastId,
    broadcastCategory: input.broadcastCategory,
    countryCode: input.countryCode,
    issuedAt: input.issuedAt,
    eventType: input.eventType,
  };
}

export function buildBroadcastNotificationMetadata(input: {
  broadcastId: string;
  broadcastCategory: string;
  countryCode: string;
  issuedAt: string;
  eventType: string;
  status?: string;
}): Record<string, unknown> {
  const routing = resolveBroadcastNotificationRouting(input);
  return {
    ...routing,
    route: routing.destination,
    deepLink: routing.destination,
    silent: false,
    ...(input.status ? { status: input.status } : {}),
  };
}

export function resolveCommunityVerificationNotificationRouting(input: {
  incidentId: string;
  verificationRequestId: string;
  category: string;
  distanceBand: string;
  issuedAt: string;
  expiresAt: string;
}): NotificationRoutingV1 {
  return {
    schemaVersion: NOTIFICATION_SCHEMA_VERSION,
    routeType: "COMMUNITY_VERIFICATION",
    notificationType: "NearbyIncidentVerification",
    eventType: "NEARBY_INCIDENT_VERIFICATION",
    destination: `/community-verification/${input.verificationRequestId}`,
    incidentId: input.incidentId,
    verificationRequestId: input.verificationRequestId,
    category: input.category,
    distanceBand: input.distanceBand,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
  };
}

export function buildCommunityVerificationNotificationMetadata(input: {
  incidentId: string;
  verificationRequestId: string;
  category: string;
  distanceBand: string;
  issuedAt: string;
  expiresAt: string;
}): Record<string, unknown> {
  const routing = resolveCommunityVerificationNotificationRouting(input);
  return {
    ...routing,
    route: routing.destination,
    deepLink: routing.destination,
    silent: false,
  };
}

export function buildIncidentMessageNotificationMetadata(input: {
  incidentId: string;
  status: IncidentStatus | string;
  messageId: string;
  notificationType: string;
}): Record<string, unknown> {
  const terminal = isTerminalIncidentStatus(input.status as IncidentStatus);
  const destination = terminal
    ? `/incident-detail/${input.incidentId}/messages`
    : `/active-emergency/${input.incidentId}/messages`;
  return {
    schemaVersion: NOTIFICATION_SCHEMA_VERSION,
    routeType: terminal ? "OWN_INCIDENT_DETAILS" : "OWN_ACTIVE_INCIDENT",
    eventType: "INCIDENT_MESSAGE_RECEIVED",
    incidentId: input.incidentId,
    messageId: input.messageId,
    notificationType: input.notificationType,
    destination,
    route: destination,
    deepLink: destination,
    issuedAt: new Date().toISOString(),
    silent: false,
  };
}

export function buildIncidentInformationRequestNotificationMetadata(input: {
  incidentId: string;
  status: IncidentStatus | string;
  requestId: string;
  notificationType: string;
}): Record<string, unknown> {
  const terminal = isTerminalIncidentStatus(input.status as IncidentStatus);
  const destination = terminal
    ? `/incident-detail/${input.incidentId}/messages`
    : `/active-emergency/${input.incidentId}/messages`;
  return {
    schemaVersion: NOTIFICATION_SCHEMA_VERSION,
    routeType: terminal ? "OWN_INCIDENT_DETAILS" : "OWN_ACTIVE_INCIDENT",
    eventType: "INCIDENT_INFORMATION_REQUEST",
    incidentId: input.incidentId,
    requestId: input.requestId,
    notificationType: input.notificationType,
    destination,
    route: destination,
    deepLink: destination,
    issuedAt: new Date().toISOString(),
    silent: false,
  };
}

export type FieldDeviceNotificationType =
  | "FIELD_DEVICE_APPROVED"
  | "FIELD_DEVICE_REJECTED"
  | "FIELD_DEVICE_SUSPENDED"
  | "FIELD_DEVICE_REVOKED"
  | "FIELD_DEVICE_REPAIR_REQUIRED"
  | "FIELD_DEVICE_PAIRING_CREATED"
  | "FIELD_DEVICE_PAIRING_EXPIRING"
  | "FIELD_DEVICE_ACTIVATED"
  | "FIELD_DEVICE_PAIRING_CANCELLED"
  | "FIELD_DEVICE_PERMISSION_CHANGED"
  | "FIELD_SESSION_REVOKED";

export function resolveFieldDeviceNotificationRouting(input: {
  publicDeviceId: string;
  notificationType: FieldDeviceNotificationType;
}): NotificationRoutingV1 {
  const destination =
    input.notificationType === "FIELD_DEVICE_PAIRING_CREATED" ||
    input.notificationType === "FIELD_DEVICE_PAIRING_EXPIRING" ||
    input.notificationType === "FIELD_DEVICE_ACTIVATED" ||
    input.notificationType === "FIELD_DEVICE_PAIRING_CANCELLED"
      ? "/pair-device"
      : "/device-registration";
  return {
    schemaVersion: NOTIFICATION_SCHEMA_VERSION,
    routeType: "FIELD_DEVICE_STATUS",
    notificationType: input.notificationType,
    destination,
  };
}

export function buildFieldDeviceNotificationMetadata(input: {
  publicDeviceId: string;
  notificationType: FieldDeviceNotificationType;
}): Record<string, unknown> {
  const routing = resolveFieldDeviceNotificationRouting(input);
  return {
    ...routing,
    route: routing.destination,
    deepLink: routing.destination,
    publicDeviceId: input.publicDeviceId,
    silent: false,
    issuedAt: new Date().toISOString(),
  };
}

export type FieldOperationalNotificationType =
  | "FIELD_ASSIGNMENT"
  | "FIELD_ASSIGNMENT_REASSIGNED"
  | "FIELD_MESSAGE"
  | "FIELD_BACKUP_REQUEST"
  | "FIELD_BACKUP_ASSIGNED"
  | "FIELD_OFFICER_SAFETY_ALERT"
  | "FIELD_CHECKPOINT_ALERT"
  | "FIELD_BOLO_ALERT"
  | "FIELD_DRONE_MISSION"
  | "FIELD_DEVICE_HEALTH_WARNING"
  | "FIELD_SHIFT_ALERT";

const FIELD_OPERATIONAL_DESTINATIONS: Record<FieldOperationalNotificationType, string> = {
  FIELD_ASSIGNMENT: "/assignments",
  FIELD_ASSIGNMENT_REASSIGNED: "/assignments",
  FIELD_MESSAGE: "/comms",
  FIELD_BACKUP_REQUEST: "/backup",
  FIELD_BACKUP_ASSIGNED: "/backup",
  FIELD_OFFICER_SAFETY_ALERT: "/safety",
  FIELD_CHECKPOINT_ALERT: "/checkpoint",
  FIELD_BOLO_ALERT: "/bolo",
  FIELD_DRONE_MISSION: "/drone",
  FIELD_DEVICE_HEALTH_WARNING: "/device-status",
  FIELD_SHIFT_ALERT: "/dashboard",
};

export function resolveFieldOperationalNotificationRouting(input: {
  notificationType: FieldOperationalNotificationType;
  assignmentId?: string;
  incidentId?: string;
  backupRequestId?: string;
  safetyAlertId?: string;
  fieldDeviceId?: string;
}): NotificationRoutingV1 {
  const base = FIELD_OPERATIONAL_DESTINATIONS[input.notificationType] ?? "/dashboard";
  return {
    schemaVersion: NOTIFICATION_SCHEMA_VERSION,
    routeType: "FIELD_OPERATIONAL",
    notificationType: input.notificationType,
    destination: base,
    assignmentId: input.assignmentId,
    incidentId: input.incidentId,
    backupRequestId: input.backupRequestId,
    safetyAlertId: input.safetyAlertId,
    fieldDeviceId: input.fieldDeviceId,
  };
}

export function buildFieldOperationalNotificationMetadata(input: {
  notificationType: FieldOperationalNotificationType;
  assignmentId?: string;
  incidentId?: string;
  backupRequestId?: string;
  safetyAlertId?: string;
  fieldDeviceId?: string;
  status?: string;
}): Record<string, unknown> {
  const routing = resolveFieldOperationalNotificationRouting(input);
  return {
    ...routing,
    route: routing.destination,
    deepLink: routing.destination,
    silent: false,
    issuedAt: new Date().toISOString(),
    ...(input.status ? { status: input.status } : {}),
  };
}

export function buildNeighborhoodWatchNotificationMetadata(input: {
  routeType: Extract<
    NotificationRouteType,
    | "NW_COMMUNITY_ALERT"
    | "NW_POST_ACTIVITY"
    | "NW_POST_COMMENT"
    | "NW_PATROL_INVITATION"
    | "NW_PATROL_UPDATE"
    | "NW_MEMBERSHIP_APPROVED"
    | "NW_MEMBERSHIP_REJECTED"
    | "NW_AREA_CHANGED"
    | "NW_ESCALATION_UPDATE"
  >;
  communityId: string;
  postId?: string;
  patrolId?: string;
  notificationType: string;
}): Record<string, unknown> {
  const destination =
    input.routeType === "NW_AREA_CHANGED"
      ? "/neighborhood-watch"
      : input.routeType === "NW_COMMUNITY_ALERT"
        ? "/neighborhood-watch/alerts"
        : input.postId
          ? `/neighborhood-watch/post/${input.postId}`
          : input.patrolId
            ? `/neighborhood-watch/patrol/${input.patrolId}`
            : input.routeType.startsWith("NW_MEMBERSHIP")
              ? `/neighborhood-watch/private/${input.communityId}/membership`
              : "/neighborhood-watch";
  const routing: NotificationRoutingV1 = {
    schemaVersion: NOTIFICATION_SCHEMA_VERSION,
    routeType: input.routeType,
    notificationType: input.notificationType,
    destination,
    communityId: input.communityId,
    postId: input.postId,
    patrolId: input.patrolId,
  };
  return {
    ...routing,
    route: destination,
    deepLink: destination,
    silent: false,
    issuedAt: new Date().toISOString(),
  };
}
