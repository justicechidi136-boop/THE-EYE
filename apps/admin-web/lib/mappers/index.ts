import type {
  AuditLogView,
  BroadcastView,
  CommunityPostView,
  CommunityView,
  DuplicateReportView,
  EvidenceAccessEntry,
  FirmwareReleaseView,
  Incident,
  LiveVideoSessionView,
  NotificationOperationView,
  PatrolScheduleView,
  PoliceStationView,
  SmartwatchDeviceView,
  SosEventView,
  UserDirectoryEntry,
  VolunteerView,
  ResidentView,
  WitnessConfirmationView,
} from "../types/admin-views";

function priorityLabel(priority: string): Incident["priority"] {
  if (priority === "P1LifeThreatening") return "P1";
  if (priority === "P2ActiveCrimeAccident") return "P2";
  if (priority === "P3SuspiciousActivity") return "P3";
  return "P4";
}

function formatTime(value?: string | Date | null) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function shortHash(hash?: string | null) {
  if (!hash) return "-";
  return `${hash.slice(0, 4)}...${hash.slice(-4)}`;
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || fallback;
  if (value && typeof value === "object" && "toNumber" in value) {
    return Number((value as { toNumber: () => number }).toNumber()) || fallback;
  }
  return fallback;
}

export function toIncidentView(record: Record<string, unknown>): Incident {
  const verifications = Array.isArray(record.verifications) ? record.verifications : [];
  const latestVerification = verifications[verifications.length - 1] as Record<string, unknown> | undefined;
  const confidenceScore = latestVerification?.confidence
    ? Math.round(toNumber(latestVerification.confidence))
    : record.status === "Verified"
      ? 85
      : 55;

  const media = Array.isArray(record.media) ? record.media : [];
  const timeline = Array.isArray(record.timeline) ? record.timeline : [];

  return {
    id: String(record.id),
    type: String(record.type ?? "Incident"),
    title: String(record.title ?? "Untitled incident"),
    description: String(record.description ?? ""),
    priority: priorityLabel(String(record.priority ?? "P4GeneralSafety")),
    status: String(record.status ?? "Submitted"),
    confidenceScore,
    createdAt: record.createdAt ? String(record.createdAt) : undefined,
    gps: {
      lat: toNumber(record.latitude),
      lng: toNumber(record.longitude),
      accuracy: record.manualLocationAdjusted ? "Manual adjustment" : "GPS",
    },
    reporterStatus: record.isAnonymous ? "Anonymous reporter" : "Identified reporter",
    reportingMode: record.isAnonymous ? "Anonymous" : "Identified",
    assignedAgency: String((record.assignedAgency as { name?: string } | undefined)?.name ?? record.assignedAgencyId ?? "Unassigned"),
    responseStatus: String(record.status ?? "Submitted"),
    location: [record.address, record.lga, record.state].filter(Boolean).join(", ") || "Unknown location",
    timeline: timeline.map((entry) => {
      const item = entry as Record<string, unknown>;
      return {
        time: formatTime(item.createdAt as string),
        event: String(item.message ?? item.eventType ?? "Update"),
        actor: String(item.actorType ?? "system"),
      };
    }),
    evidence: media.map((item) => {
      const mediaItem = item as Record<string, unknown>;
      return {
        id: String(mediaItem.id ?? ""),
        type: String(mediaItem.mediaType ?? "Media"),
        name: String(mediaItem.objectKey ?? "evidence"),
        hash: String(mediaItem.fileHash ?? "pending"),
        contentType: mediaItem.contentType ? String(mediaItem.contentType) : undefined,
      };
    }),
  };
}

export function toBroadcastView(record: Record<string, unknown>): BroadcastView {
  const deliveries = Array.isArray(record.deliveries) ? record.deliveries : [];
  const status = String(record.status ?? "Draft");
  const recipients = deliveries.length;
  const scheduledAt = record.scheduledAt ? String(record.scheduledAt) : null;
  const dispatchFailureReason = record.dispatchFailureReason ? String(record.dispatchFailureReason) : null;
  const delivery =
    status === "Published"
      ? recipients > 0
        ? "Sent"
        : "Published"
      : status === "Failed"
        ? "Failed"
        : status === "Scheduled" || status === "DispatchQueued" || status === "Dispatching"
          ? "Scheduled"
          : status === "PendingApproval"
            ? "Queued"
            : "Not dispatched";
  const autoDispatchStatus =
    status === "Failed"
      ? "Auto-dispatch failed"
      : status === "DispatchQueued" || status === "Dispatching"
        ? "Auto-dispatch in progress"
        : status === "Scheduled" && scheduledAt
          ? "Waiting for scheduler"
          : status === "Published" && recipients > 0
            ? "Dispatched"
            : "Manual / pending";

  return {
    id: String(record.id),
    type: `${String(record.type ?? "Broadcast")} broadcast`,
    title: String(record.title ?? "Untitled broadcast"),
    severity: priorityLabel(String(record.priority ?? "P4GeneralSafety")),
    status: status === "PendingApproval" ? "Pending approval" : status,
    target:
      record.targetRadiusMeters != null
        ? `${toNumber(record.targetRadiusMeters)} m geofence`
        : record.targetArea
          ? "Custom geofence area"
          : "Jurisdiction target",
    author: String((record.creator as { displayName?: string } | undefined)?.displayName ?? "Admin"),
    requiresApproval: Boolean(record.requiresApproval ?? true),
    recipients,
    delivery,
    scheduledAt,
    schedulingState: status === "PendingApproval" ? "Pending approval" : status,
    dispatchFailureReason,
    autoDispatchStatus,
  };
}

export function toAuditLogView(record: Record<string, unknown>, chainVerified = true): AuditLogView {
  return {
    sequence: String(record.sequence ?? "0").padStart(6, "0"),
    time: formatTime(record.createdAt as string),
    actor: String(record.actorType ?? record.actorAdminId ?? record.actorUserId ?? "system"),
    action: String(record.action ?? "unknown"),
    entity: String(record.entityId ?? record.entityType ?? "-"),
    reason: String(record.reason ?? "-"),
    previousHash: shortHash(record.previousHash as string),
    eventHash: shortHash(record.eventHash as string),
    chain: chainVerified ? "Verified" : "Broken",
  };
}

export function toUserDirectoryEntry(record: Record<string, unknown>): UserDirectoryEntry {
  return {
    id: String(record.id),
    name: String(record.name ?? "Unknown"),
    role: String(record.role ?? "User"),
    status: String(record.status ?? "Active"),
    scope: String(record.scope ?? "-"),
  };
}

export function toCommunityView(record: Record<string, unknown>): CommunityView {
  const memberships = Array.isArray(record.memberships) ? record.memberships : [];
  const posts = Array.isArray(record.posts) ? record.posts : [];
  const pending = memberships.filter((item) => (item as Record<string, unknown>).status === "Pending").length;
  const confidenceValues = posts
    .map((post) => toNumber((post as Record<string, unknown>).confidenceScore))
    .filter((score) => score > 0);
  const confidence = confidenceValues.length
    ? Math.round(confidenceValues.reduce((sum, score) => sum + score, 0) / confidenceValues.length)
    : 0;

  return {
    id: String(record.id),
    name: String(record.name ?? "Community"),
    level: String(record.level ?? "Community"),
    visibility: String(record.visibility ?? "Public"),
    hierarchy: [record.country, record.state, record.lga, record.ward].filter(Boolean).join(" / "),
    members: memberships.filter((item) => (item as Record<string, unknown>).status === "Approved").length,
    pending,
    posts: posts.length,
    confidence,
  };
}

export function toCommunityPostView(record: Record<string, unknown>): CommunityPostView {
  return {
    id: String(record.id),
    community: String((record.community as { name?: string } | undefined)?.name ?? record.communityId ?? "Community"),
    communityId: record.communityId ? String(record.communityId) : undefined,
    type: String(record.type ?? "Post"),
    title: String(record.title ?? record.body ?? "Community post"),
    status: String(record.verificationStatus ?? "Pending Verification"),
    confidence: Math.round(toNumber(record.confidenceScore)),
    linkedIncident: String(record.incidentId ?? "-"),
    author: String(record.authorId ?? "Resident"),
    location: `${toNumber(record.latitude)}, ${toNumber(record.longitude)}`,
  };
}

export function toVolunteerView(record: Record<string, unknown>): VolunteerView {
  const profile = (record.user as { profile?: { firstName?: string; lastName?: string } } | undefined)?.profile;
  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Volunteer";
  return {
    id: String(record.id ?? record.userId ?? ""),
    name,
    type: Array.isArray(record.types) ? record.types.join(", ") : String(record.types ?? "Volunteer"),
    community: String((record.community as { name?: string } | undefined)?.name ?? record.communityId ?? "-"),
    status: record.verified ? "Verified" : record.available ? "Available" : "Unavailable",
    distance: "-",
    latitude: record.latitude == null ? undefined : Number(record.latitude),
    longitude: record.longitude == null ? undefined : Number(record.longitude),
  };
}

export function toPatrolScheduleView(record: Record<string, unknown>): PatrolScheduleView {
  const checkpoints = Array.isArray(record.checkpoints) ? record.checkpoints : [];
  const firstCheckpoint = checkpoints[0] as Record<string, unknown> | undefined;
  return {
    id: String(record.id),
    title: String(record.title ?? "Patrol"),
    community: String((record.community as { name?: string } | undefined)?.name ?? record.communityId ?? "-"),
    status: String(record.status ?? "Scheduled"),
    volunteers: Array.isArray(record.assignments) ? record.assignments.length : Array.isArray(record.volunteerUserIds) ? record.volunteerUserIds.length : 0,
    checkpoints: checkpoints.length,
    latitude: firstCheckpoint?.latitude == null ? undefined : Number(firstCheckpoint.latitude),
    longitude: firstCheckpoint?.longitude == null ? undefined : Number(firstCheckpoint.longitude),
  };
}

export function toResidentView(
  membership: Record<string, unknown>,
  community: { id: string; name: string },
): ResidentView {
  const user = membership.user as Record<string, unknown> | undefined;
  const profile = user?.profile as { firstName?: string; lastName?: string } | undefined;
  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Resident";
  const roleRecord = membership.role as { name?: string } | undefined;
  return {
    id: String(user?.id ?? membership.userId ?? membership.id),
    membershipId: String(membership.id),
    communityId: community.id,
    community: community.name,
    name,
    email: String(user?.email ?? "-"),
    phone: String(user?.phone ?? "-"),
    status: String(membership.status ?? "Pending"),
    role: String(roleRecord?.name ?? membership.roleName ?? "Resident"),
    trustScore: Math.round(toNumber(user?.trustScore, 70)),
    volunteerStatus: membership.volunteerProfile ? "Registered" : "None",
    smartwatchStatus: membership.smartwatchDevice ? "Paired" : "None",
  };
}

export function toSmartwatchDeviceView(record: Record<string, unknown>): SmartwatchDeviceView {
  const profile = (record.user as { profile?: { firstName?: string; lastName?: string } } | undefined)?.profile;
  const owner = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Unknown owner";
  const battery = toNumber(record.batteryPercent, 0);
  const signal = toNumber(record.signalStrength, 0);
  const online = Boolean(record.isOnline);
  const needsAttention = battery < 20 || signal < 25;

  return {
    id: String(record.id),
    deviceId: String(record.deviceId ?? record.id),
    owner,
    provider: String(record.provider ?? "Smartwatch"),
    model: String(record.model ?? "Unknown"),
    mode: String(record.connectivityMode ?? "Paired phone"),
    preferredMode: String(record.preferredMode ?? record.connectivityMode ?? "Paired phone"),
    pairingMethod: String(record.pairingMethod ?? "Pairing Code"),
    status: needsAttention ? "Needs attention" : online ? "Online" : "Offline",
    battery,
    signal,
    firmware: String(record.firmwareVersion ?? "unknown"),
    security: record.certificateValid === false ? "Certificate invalid" : "Certificate valid",
    alerts: record.criticalAlertsEnabled === false ? "Disabled" : "Enabled",
    lastSeen: formatTime(record.lastSeenAt as string),
    lastGps: {
      lat: toNumber(record.lastLatitude),
      lng: toNumber(record.lastLongitude),
      accuracy: record.lastAccuracyMeters ? `${toNumber(record.lastAccuracyMeters)}m` : "-",
    },
  };
}

export function toFirmwareReleaseView(record: Record<string, unknown>): FirmwareReleaseView {
  return {
    version: String(record.version ?? "0.0.0"),
    title: String(record.title ?? "Firmware release"),
    status: String(record.status ?? "Draft"),
    signature: record.signature ? "Valid" : "Pending",
    devices: 0,
    rollback: record.status === "Published" ? "Available" : "-",
  };
}

export function toSosEventView(record: Record<string, unknown>): SosEventView {
  const profile = (record.user as { profile?: { firstName?: string; lastName?: string } } | undefined)?.profile;
  const user = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Unknown user";
  return {
    id: String(record.id),
    incidentId: String(record.incidentId ?? "-"),
    user,
    deviceId: String((record.device as { deviceId?: string } | undefined)?.deviceId ?? record.deviceId ?? "-"),
    status: String(record.status ?? "Active"),
    sourceMode: String(record.sourceMode ?? record.connectivityMode ?? "Unknown"),
    priority: "P1",
    triggeredAt: formatTime(record.triggeredAt as string),
    familyAlerted: record.familyContactsNotified ? "Yes" : "No",
    response: String((record.incident as { assignedAgencyId?: string } | undefined)?.assignedAgencyId ?? "Pending assignment"),
    gps: {
      lat: toNumber(record.latitude),
      lng: toNumber(record.longitude),
      accuracy: record.accuracyMeters ? `${toNumber(record.accuracyMeters)}m` : "-",
    },
  };
}

export function toNotificationOperationView(record: Record<string, unknown>): NotificationOperationView {
  const deliveryLogs = Array.isArray(record.deliveryLogs) ? record.deliveryLogs : [];
  const targetLatitude = record.targetLatitude;
  const targetLongitude = record.targetLongitude;
  const target =
    targetLatitude !== undefined && targetLongitude !== undefined
      ? `${toNumber(targetLatitude)}, ${toNumber(targetLongitude)}`
      : record.userId
        ? `User ${String(record.userId).slice(0, 8)}`
        : record.adminUserId
          ? `Admin ${String(record.adminUserId).slice(0, 8)}`
          : "System";

  return {
    id: String(record.id),
    title: String(record.title ?? "Notification"),
    type: String(record.type ?? "System"),
    channel: String(record.channel ?? "push"),
    provider: String(record.provider ?? "-"),
    priority: String(record.priority ?? "Normal"),
    target,
    status: String(record.status ?? "Pending"),
    read: record.readAt ? "Yes" : "No",
    logs: deliveryLogs.length,
  };
}

export function toLiveVideoSessionView(record: Record<string, unknown>): LiveVideoSessionView {
  const incident = (record.incident as Record<string, unknown> | undefined) ?? {};
  const latest = Array.isArray(record.locationUpdates) ? (record.locationUpdates[0] as Record<string, unknown> | undefined) : undefined;
  const startedAt = record.startedAt ? new Date(String(record.startedAt)) : new Date();
  const latitude = toNumber(latest?.latitude ?? incident.latitude);
  const longitude = toNumber(latest?.longitude ?? incident.longitude);
  const accuracyMeters = toNumber(latest?.accuracy ?? latest?.accuracyMeters, 0);

  return {
    id: String(record.id),
    incidentId: String(incident.id ?? record.incidentId ?? "-"),
    roomName: String(record.roomName ?? "-"),
    status: String(record.status ?? "Active"),
    startedAt: startedAt.toISOString(),
    date: startedAt.toLocaleDateString("en-GB"),
    time: formatTime(startedAt),
    latitude,
    longitude,
    accuracy: accuracyMeters ? `${accuracyMeters}m` : "-",
    reporter: incident.isAnonymous ? "Anonymous reporter" : "Identified reporter",
    viewerScope: "Admin jurisdiction",
    signedLocationPath: `/live-video/sessions/${String(record.id)}/location/history`,
    locationHistory: latest
      ? [{ time: formatTime(latest.capturedAt as string), gps: `${latitude}, ${longitude}`, accuracy: accuracyMeters ? `${accuracyMeters}m` : "-" }]
      : [],
    recordingConfigured: record.recordingMediaId != null,
    connectionStatus: String(record.status ?? "Inactive") === "Active" ? "Awaiting viewer" : "Inactive",
  };
}

export function toPoliceStationView(record: Record<string, unknown>): PoliceStationView {
  const jurisdiction = (record.jurisdiction as Record<string, unknown> | undefined) ?? {};
  const distanceMeters = toNumber(record.distance_meters ?? record.distanceMeters, 0);
  const latitude = toNumber(record.latitude);
  const longitude = toNumber(record.longitude);

  return {
    id: String(record.id),
    name: String(record.name ?? "Station"),
    phone: String(record.phone ?? "-"),
    address: String(record.address ?? "-"),
    state: String(jurisdiction.state ?? record.state ?? "-"),
    lga: String(jurisdiction.lga ?? record.lga ?? "-"),
    latitude,
    longitude,
    agencyType: String(record.agency_type ?? record.agencyType ?? "police"),
    distance: distanceMeters ? `${Math.round(distanceMeters)} m` : "-",
    navigationUrl: String(record.navigationUrl ?? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`),
  };
}

export function toDuplicateReportView(record: Record<string, unknown>): DuplicateReportView {
  const distanceMeters = toNumber(record.distance_meters ?? record.distanceMeters, 0);
  return {
    id: String(record.id),
    title: String(record.title ?? "Duplicate report"),
    distance: distanceMeters ? `${Math.round(distanceMeters)}m` : "-",
    confidence: 70,
  };
}

export function toWitnessConfirmationView(record: Record<string, unknown>): WitnessConfirmationView {
  return {
    id: String(record.id),
    verifierName: String(record.verifierName ?? "Witness"),
    method: String(record.method ?? "nearby_user_confirmation"),
    result: String(record.result ?? "pending"),
    confidence: record.confidence == null ? null : toNumber(record.confidence, 0),
    notes: record.notes ? String(record.notes) : null,
    createdAt: formatTime(record.createdAt as string | Date | null | undefined),
  };
}

export function toEvidenceAccessEntry(record: Record<string, unknown>): EvidenceAccessEntry {
  const metadata = (record.metadata as Record<string, unknown> | undefined) ?? {};
  const action = String(record.action ?? "accessed");
  const file = String(metadata.objectKey ?? metadata.fileHash ?? record.entityId ?? "evidence");
  return {
    actor: String(record.actorType ?? record.actorAdminId ?? record.actorUserId ?? "system"),
    file,
    action: action.includes("download") ? "Downloaded" : "Viewed",
    time: formatTime(record.createdAt as string),
  };
}

export function evidenceAccessEntriesForIncident(incidentId: string, logs: Record<string, unknown>[]): EvidenceAccessEntry[] {
  return logs
    .filter((log) => {
      const metadata = (log.metadata as Record<string, unknown> | undefined) ?? {};
      return String(metadata.incidentId ?? "") === incidentId;
    })
    .map((log) => toEvidenceAccessEntry(log));
}
