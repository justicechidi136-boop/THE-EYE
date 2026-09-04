import type {
  AuditLogView,
  BroadcastView,
  BroadcastDetailView,
  BroadcastReportView,
  CommunityPostView,
  CommunityView,
  DuplicateReportView,
  EvidenceAccessEntry,
  FirmwareReleaseView,
  DangerZoneView,
  Incident,
  MissingPersonCaseView,
  StolenVehicleCaseView,
  LiveVideoSessionView,
  NotificationOperationView,
  PatrolScheduleView,
  PoliceStationView,
  SmartwatchDeviceView,
  SmartwatchDeviceDetailView,
  FieldDeviceView,
  FieldPermissionProfileView,
  AgencyView,
  AgencyUnitView,
  PairingSessionView,
  ActivationHistoryView,
  SosEventView,
  UserDirectoryEntry,
  VolunteerView,
  ResidentView,
  WitnessConfirmationView,
} from "../types/admin-views";
import { normalizeBroadcastAttachments } from "../admin-media";
import { humanLocation, sanitizeLocationTrail } from "../admin-presentation";

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
  const statusHistory = Array.isArray(record.statusHistory) ? record.statusHistory : [];
  const rawLocations = Array.isArray(record.locationUpdates) ? record.locationUpdates : [];
  const locationHistory = sanitizeLocationTrail(rawLocations.map((entry) => {
    const point = entry as Record<string, unknown>;
    return {
      latitude: toNumber(point.latitude),
      longitude: toNumber(point.longitude),
      accuracyMeters: point.accuracy != null ? toNumber(point.accuracy) : null,
      capturedAt: String(point.capturedAt ?? point.receivedAt ?? record.createdAt ?? new Date(0).toISOString()),
    };
  }));
  const reporter = (record.reporter as Record<string, unknown> | undefined) ?? {};
  const reporterProfile = (reporter.profile as Record<string, unknown> | undefined) ?? {};
  const reporterName = [reporterProfile.firstName, reporterProfile.lastName].filter(Boolean).join(" ");
  const anonymous = Boolean(record.isAnonymous);
  const metadata = record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
    ? record.metadata as Record<string, unknown>
    : {};
  const metadataLocation = metadata.location && typeof metadata.location === "object" && !Array.isArray(metadata.location)
    ? metadata.location as Record<string, unknown>
    : {};

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
      accuracy: locationHistory.at(-1)?.accuracyMeters != null
        ? `${locationHistory.at(-1)?.accuracyMeters}m`
        : record.manualLocationAdjusted ? "Manual adjustment" : "Unknown",
    },
    locationHistory,
    reporterStatus: anonymous ? "Anonymous reporter" : reporterName || "Identified reporter",
    reporter: {
      label: anonymous ? "Anonymous reporter" : reporterName || "Identified reporter",
      accountReference: anonymous || !reporter.id ? null : `User ${String(reporter.id).slice(0, 8)}`,
      anonymous,
    },
    reportingMode: anonymous ? "Anonymous" : "Identified",
    assignedAgency: String((record.assignedAgency as { name?: string } | undefined)?.name ?? record.assignedAgencyId ?? "Unassigned"),
    responseStatus: String(record.status ?? "Submitted"),
    location: humanLocation([
      record.manualAddress,
      record.address,
      metadata.communityName,
      metadata.community,
      metadata.neighborhood,
      metadata.neighbourhood,
      metadataLocation.community,
      metadataLocation.neighborhood,
      metadataLocation.neighbourhood,
      metadata.town,
      metadata.city,
      metadataLocation.town,
      metadataLocation.city,
      record.lga,
      record.state,
      record.country,
    ]),
    timeline: [...timeline.map((entry) => {
      const item = entry as Record<string, unknown>;
      return {
        time: formatTime(item.createdAt as string),
        event: String(item.message ?? item.eventType ?? "Update"),
        actor: (() => {
          const actor = (item.actor as Record<string, unknown> | undefined) ?? {};
          const profile = (actor.profile as Record<string, unknown> | undefined) ?? {};
          const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
          if (anonymous && String(item.actorType) === "user") return "Anonymous reporter";
          if (name) return `${name} (reporter)`;
          if (item.actorType === "admin") return "Administrator";
          if (item.actorType === "user") return "Reporter";
          return "System";
        })(),
      };
    }), ...statusHistory.map((entry) => {
      const item = entry as Record<string, unknown>;
      const changedBy = (item.changedBy as Record<string, unknown> | undefined) ?? {};
      const profile = (changedBy.profile as Record<string, unknown> | undefined) ?? {};
      const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
      return {
        time: formatTime(item.createdAt as string),
        event: `Status changed to ${String(item.toStatus ?? "updated")}${item.note ? `: ${String(item.note)}` : ""}`,
        actor: name ? `${name} (authorized actor)` : item.changedById ? "Authorized user" : "System",
      };
    })],
    evidence: media.map((item) => {
      const mediaItem = item as Record<string, unknown>;
      return {
        id: String(mediaItem.id ?? ""),
        type: String(mediaItem.mediaType ?? "Media"),
        name: String(mediaItem.objectKey ?? "evidence"),
        hash: String(mediaItem.fileHash ?? "pending"),
        contentType: mediaItem.contentType ? String(mediaItem.contentType) : undefined,
        durationSeconds: mediaItem.durationSeconds != null ? Number(mediaItem.durationSeconds) : null,
        transcriptionStatus: mediaItem.transcriptionStatus ? String(mediaItem.transcriptionStatus) : null,
        transcript: mediaItem.transcript ? String(mediaItem.transcript) : null,
        translatedTranscript: mediaItem.translatedTranscript ? String(mediaItem.translatedTranscript) : null,
        selectedLanguage: mediaItem.selectedLanguage ? String(mediaItem.selectedLanguage) : null,
        detectedLanguage: mediaItem.detectedLanguage ? String(mediaItem.detectedLanguage) : null,
        transcriptionConfidence:
          mediaItem.transcriptionConfidence != null ? Number(mediaItem.transcriptionConfidence) : null,
        uploadedAt: mediaItem.uploadedAt ? String(mediaItem.uploadedAt) : null,
      };
    }),
  };
}

function broadcastAuthorLabel(record: Record<string, unknown>): "Citizen" | "Admin" | "Verified" {
  const authorType = String(record.authorType ?? "Admin");
  const adminVerified = Boolean(record.adminVerified);
  if (authorType === "Admin") return "Admin";
  if (adminVerified) return "Verified";
  return "Citizen";
}

function broadcastReportCount(record: Record<string, unknown>) {
  const count = record._count as { reports?: number } | undefined;
  if (typeof count?.reports === "number") return count.reports;
  return Array.isArray(record.reports) ? record.reports.length : 0;
}

function broadcastCommentCount(record: Record<string, unknown>) {
  const count = record._count as { comments?: number } | undefined;
  if (typeof count?.comments === "number") return count.comments;
  return Array.isArray(record.comments) ? record.comments.length : 0;
}

function broadcastSightingsCount(record: Record<string, unknown>) {
  const count = record._count as { sightings?: number } | undefined;
  if (typeof count?.sightings === "number") return count.sightings;
  return Array.isArray(record.sightings) ? record.sightings.length : 0;
}

function toEvidenceItems(record: Record<string, unknown>) {
  const incident = (record.incident ?? record) as Record<string, unknown>;
  const media = Array.isArray(incident.media) ? incident.media : [];
  return media.map((item) => {
    const mediaItem = item as Record<string, unknown>;
    return {
      id: String(mediaItem.id ?? ""),
      type: String(mediaItem.mediaType ?? "Media"),
      name: mediaItem.contentType ? String(mediaItem.contentType) : String(mediaItem.mediaType ?? "Evidence"),
      hash: mediaItem.fileHash ? String(mediaItem.fileHash).slice(0, 12) : "pending",
      contentType: mediaItem.contentType ? String(mediaItem.contentType) : undefined,
      durationSeconds: mediaItem.durationSeconds != null ? Number(mediaItem.durationSeconds) : null,
      transcriptionStatus: mediaItem.transcriptionStatus ? String(mediaItem.transcriptionStatus) : null,
      transcript: mediaItem.transcript ? String(mediaItem.transcript) : null,
      translatedTranscript: mediaItem.translatedTranscript ? String(mediaItem.translatedTranscript) : null,
      selectedLanguage: mediaItem.selectedLanguage ? String(mediaItem.selectedLanguage) : null,
      detectedLanguage: mediaItem.detectedLanguage ? String(mediaItem.detectedLanguage) : null,
      transcriptionConfidence:
        mediaItem.transcriptionConfidence != null ? Number(mediaItem.transcriptionConfidence) : null,
      uploadedAt: mediaItem.uploadedAt ? String(mediaItem.uploadedAt) : null,
    };
  });
}

function broadcastRecipientCount(record: Record<string, unknown>) {
  const count = record._count as { deliveries?: number } | undefined;
  if (typeof count?.deliveries === "number") return count.deliveries;
  return Array.isArray(record.deliveries) ? record.deliveries.length : 0;
}

export function toBroadcastView(record: Record<string, unknown>): BroadcastView {
  const deliveries = Array.isArray(record.deliveries) ? record.deliveries : [];
  const status = String(record.status ?? "Draft");
  const recipients = deliveries.length || broadcastRecipientCount(record);
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

  const metadata = (record.metadata as Record<string, unknown> | undefined) ?? {};
  const targetMetadata = (metadata.target as Record<string, unknown> | undefined) ?? {};
  const creatorProfile = ((record.creatorUser as { profile?: { firstName?: string; lastName?: string } } | undefined)?.profile);
  const creatorUserName = [creatorProfile?.firstName, creatorProfile?.lastName].filter(Boolean).join(" ").trim();
  const targetLocation = humanLocation([
    targetMetadata.label,
    metadata.address,
    metadata.lastSeenAddress,
    metadata.lastKnownLocation,
    metadata.approximateArea,
    record.lga,
    record.state,
    record.country,
  ]);
  const radiusMeters = record.targetRadiusMeters == null ? null : toNumber(record.targetRadiusMeters);

  return {
    id: String(record.id),
    type: `${String(record.type ?? "Broadcast")} broadcast`,
    title: String(record.title ?? "Untitled broadcast"),
    severity: priorityLabel(String(record.priority ?? "P4GeneralSafety")),
    status: status === "PendingApproval" ? "Pending approval" : status,
    target:
      radiusMeters != null
        ? `${targetLocation === "Location unavailable" ? "Selected area" : targetLocation} · ${radiusMeters >= 1000 ? `${Number((radiusMeters / 1000).toFixed(1))} km` : `${radiusMeters} m`} radius`
        : targetLocation === "Location unavailable"
          ? "Jurisdiction-wide"
          : `${targetLocation} · Jurisdiction-wide`,
    author: String(
      (record.creator as { displayName?: string } | undefined)?.displayName
        || creatorUserName
        || broadcastAuthorLabel(record),
    ),
    authorLabel: broadcastAuthorLabel(record),
    requiresApproval: Boolean(record.requiresApproval ?? true),
    recipients,
    delivery,
    scheduledAt,
    schedulingState: status === "PendingApproval" ? "Pending approval" : status,
    dispatchFailureReason,
    autoDispatchStatus,
    adminVerified: Boolean(record.adminVerified),
    reportCount: broadcastReportCount(record),
    sightingsCount: broadcastSightingsCount(record),
    commentCount: broadcastCommentCount(record),
    country: record.country ? String(record.country) : null,
    state: record.state ? String(record.state) : null,
    suspendedReason: record.suspendedReason ? String(record.suspendedReason) : null,
    createdAt: record.createdAt ? String(record.createdAt) : null,
  };
}

export function toBroadcastDetailView(record: Record<string, unknown>): BroadcastDetailView {
  const sightingsRaw = Array.isArray(record.sightings) ? record.sightings : [];
  const metadata = (record.metadata as Record<string, unknown> | undefined) ?? {};
  const persistedMedia = Array.isArray(record.media) ? record.media : [];
  const deliveries = Array.isArray(record.deliveries) ? record.deliveries : [];
  const deliveryCounts = new Map<string, number>();
  for (const entry of deliveries) {
    const status = String((entry as Record<string, unknown>).status ?? "Unknown");
    deliveryCounts.set(status, (deliveryCounts.get(status) ?? 0) + 1);
  }
  const approver = (record.approver as { displayName?: string } | undefined)?.displayName ?? null;
  const verifier = (record.verifiedBy as { displayName?: string } | undefined)?.displayName ?? null;
  const timeline = [
    record.createdAt ? { at: String(record.createdAt), label: "Broadcast created", actor: toBroadcastView(record).author } : null,
    record.publishedAt ? { at: String(record.publishedAt), label: "Broadcast published", actor: approver ?? toBroadcastView(record).author } : null,
    record.verifiedAt ? { at: String(record.verifiedAt), label: "Broadcast verified", actor: verifier ?? "Authorized administrator" } : null,
    record.suspendedAt ? { at: String(record.suspendedAt), label: "Broadcast suspended", actor: "Authorized administrator" } : null,
    record.resolvedAt ? { at: String(record.resolvedAt), label: "Broadcast resolved", actor: "Authorized actor" } : null,
    record.withdrawnAt ? { at: String(record.withdrawnAt), label: "Broadcast withdrawn", actor: "Broadcast owner" } : null,
  ].filter((entry): entry is { at: string; label: string; actor: string } => entry !== null)
    .sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime());
  const location = humanLocation([
    metadata.address,
    metadata.lastSeenAddress,
    metadata.lastKnownLocation,
    metadata.approximateArea,
    record.lga,
    record.state,
    record.country,
  ]);
  const detailKeys: Array<[string, string]> = [
    ["Full name", "fullName"],
    ["Age", "age"],
    ["Gender", "gender"],
    ["Last seen", "lastSeenAt"],
    ["Last-seen location", "lastSeenAddress"],
    ["Distinguishing information", "distinguishingFeatures"],
    ["Make", "make"],
    ["Model", "model"],
    ["Year", "year"],
    ["Colour", "color"],
    ["Plate number", "plateNumber"],
    ["VIN / chassis", "vin"],
  ];
  const textValue = (key: string, fallback = "Not provided") => {
    const value = metadata[key];
    return value == null || String(value).trim().length === 0 ? fallback : String(value);
  };
  const nullableDate = (key: string) => metadata[key] == null ? null : String(metadata[key]);
  return {
    ...toBroadcastView(record),
    body: String(record.body ?? ""),
    incidentId: record.incidentId ? String(record.incidentId) : null,
    publishedAt: record.publishedAt ? String(record.publishedAt) : null,
    resolvedAt: record.resolvedAt ? String(record.resolvedAt) : null,
    suspendedAt: record.suspendedAt ? String(record.suspendedAt) : null,
    targetLatitude: record.targetLatitude == null ? null : toNumber(record.targetLatitude),
    targetLongitude: record.targetLongitude == null ? null : toNumber(record.targetLongitude),
    targetRadiusMeters: record.targetRadiusMeters == null ? null : toNumber(record.targetRadiusMeters),
    approval: {
      required: Boolean(record.requiresApproval),
      approvedBy: approver,
      verifiedBy: verifier,
      verifiedAt: record.verifiedAt ? String(record.verifiedAt) : null,
    },
    deliveryBreakdown: Array.from(deliveryCounts, ([status, count]) => ({ status, count })),
    timeline,
    attachments: persistedMedia.length
      ? normalizeBroadcastAttachments(persistedMedia.map((item) => {
          const media = item as Record<string, unknown>;
          return {
            id: media.id,
            mediaType: String(media.mediaType ?? "").toLowerCase(),
            label: media.role ?? media.mediaType ?? "Evidence",
            contentType: media.contentType,
          };
        }))
      : normalizeBroadcastAttachments(metadata.attachments),
    location,
    details: detailKeys
      .map(([label, key]) => ({ label, value: metadata[key] == null ? "" : String(metadata[key]) }))
      .filter((item) => item.value.trim().length > 0),
    missingPerson: String(record.type) === "MissingPerson" ? {
      fullName: textValue("fullName"),
      age: textValue("ageOrApproximateAge"),
      gender: textValue("gender"),
      physicalDescription: textValue("physicalDescription"),
      clothingDescription: textValue("clothingDescription"),
      additionalInformation: textValue("additionalDescription"),
      lastSeenAt: nullableDate("lastSeenAt"),
      lastSeenLocation: textValue("lastSeenAddress", location),
    } : null,
    stolenVehicle: String(record.type) === "StolenVehicle" ? {
      make: textValue("make"),
      model: textValue("model"),
      year: textValue("year"),
      colour: textValue("colour", textValue("color")),
      plateNumber: textValue("registrationNumber", textValue("plateNumber")),
      vin: textValue("vin", textValue("vinLastFour")),
      distinguishingFeatures: textValue("distinguishingFeatures"),
      theftAccount: textValue("theftDescription", String(record.body ?? "Not provided")),
      stolenAt: nullableDate("stolenAt"),
      lastSeenAt: nullableDate("lastSeenAt"),
      lastKnownLocation: textValue("lastKnownLocation", location),
    } : null,
    sightings: sightingsRaw.map((entry) => {
      const row = entry as Record<string, unknown>;
      const metadata = (row.metadata as Record<string, unknown> | undefined) ?? {};
      const persistedAttachments = Array.isArray(row.media) ? row.media : [];
      const attachments = persistedAttachments.length
        ? normalizeBroadcastAttachments(persistedAttachments.map((item) => {
            const media = item as Record<string, unknown>;
            return {
              id: media.id,
              mediaType: String(media.mediaType ?? "").toLowerCase(),
              label: media.role ?? media.mediaType ?? "Sighting evidence",
              contentType: media.contentType,
            };
          }))
        : normalizeBroadcastAttachments(metadata.attachments);
      const profile = ((row.reporter as { profile?: { firstName?: string; lastName?: string } } | undefined)?.profile);
      const reporterName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();
      return {
        id: String(row.id ?? ""),
        observedAt: row.observedAt ? String(row.observedAt) : null,
        approximateArea: row.approximateArea ? String(row.approximateArea) : null,
        description: String(row.description ?? ""),
        locationMode: String(metadata.locationMode ?? "NOT_PROVIDED"),
        attachmentsCount: attachments.length,
        reporter: row.anonymousPublic ? "Anonymous" : reporterName || "Identified citizen",
        latitude: row.latitude == null ? null : toNumber(row.latitude),
        longitude: row.longitude == null ? null : toNumber(row.longitude),
        directionOfTravel: row.directionOfTravel ? String(row.directionOfTravel) : null,
        confidence: row.confidence ? String(row.confidence) : null,
        reviewStatus: ["Verified", "Unverified", "Dismissed"].includes(String(metadata.reviewStatus))
          ? String(metadata.reviewStatus) as "Verified" | "Unverified" | "Dismissed"
          : "Pending review",
        reviewNote: metadata.reviewNote ? String(metadata.reviewNote) : null,
        reportedAt: row.createdAt ? String(row.createdAt) : null,
        attachments,
      };
    }),
  };
}

export function toBroadcastReportView(record: Record<string, unknown>): BroadcastReportView {
  return {
    id: String(record.id),
    broadcastId: String(record.broadcastId),
    reason: String(record.reason ?? "Unknown"),
    details: String(record.details ?? ""),
    status: String(record.status ?? "Open"),
    createdAt: record.createdAt ? String(record.createdAt) : null,
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
    status: record.status ? String(record.status) : undefined,
    description: record.description ? String(record.description) : undefined,
    country: record.country ? String(record.country) : undefined,
    state: record.state ? String(record.state) : undefined,
    lga: record.lga ? String(record.lga) : undefined,
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
    communityId: record.communityId ? String(record.communityId) : undefined,
    status: String(record.status ?? "Scheduled"),
    volunteers: Array.isArray(record.assignments) ? record.assignments.length : Array.isArray(record.volunteerUserIds) ? record.volunteerUserIds.length : 0,
    checkpoints: checkpoints.length,
    startsAt: record.startsAt ? String(record.startsAt) : undefined,
    endsAt: record.endsAt ? String(record.endsAt) : undefined,
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
  const battery = toNumber(record.batteryLevel ?? record.batteryPercent, 0);
  const signal = toNumber(record.signalStrength, 0);
  const lastSeenAt = record.lastSeenAt ? String(record.lastSeenAt) : null;
  const lastSeenMs = lastSeenAt ? new Date(lastSeenAt).getTime() : Number.NaN;
  const online = Boolean(record.isOnline) && Number.isFinite(lastSeenMs) && Date.now() - lastSeenMs <= 10 * 60 * 1000;
  const needsAttention = battery < 20 || signal < 25;
  const signatureStatus = String(record.firmwareSignatureStatus ?? "Unknown");

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
    firmwareSignatureStatus: signatureStatus,
    security: signatureStatus === "Invalid" ? "Certificate invalid" : "Certificate valid",
    alerts: record.criticalAlertsEnabled === false ? "Disabled" : "Enabled",
    isActive: record.isActive !== false,
    activationStatus: String(record.activationStatus ?? "USABLE"),
    activationLockedAt: record.activationLockedAt ? String(record.activationLockedAt) : null,
    activationLockReason: record.activationLockReason ? String(record.activationLockReason) : null,
    deactivatedAt: record.securityDeactivatedAt || record.remoteDisabledAt
      ? String(record.securityDeactivatedAt ?? record.remoteDisabledAt)
      : null,
    deactivationReason: record.deactivationReason ? String(record.deactivationReason) : null,
    isOnline: online,
    lastSeen: formatTime(record.lastSeenAt as string),
    lastSeenAt,
    lastGpsAt: record.lastGpsAt ? String(record.lastGpsAt) : undefined,
    lastGps: {
      lat: record.lastLatitude == null ? null : toNumber(record.lastLatitude),
      lng: record.lastLongitude == null ? null : toNumber(record.lastLongitude),
      accuracy: record.lastGpsAccuracy ? `${toNumber(record.lastGpsAccuracy)}m` : "-",
    },
  };
}

export function toSmartwatchDeviceDetailView(record: Record<string, unknown>): SmartwatchDeviceDetailView {
  const base = toSmartwatchDeviceView(record);
  const sosEvents = Array.isArray(record.sosEvents) ? record.sosEvents.map((entry) => toSosEventView(entry as Record<string, unknown>)) : [];
  const gpsTracks = Array.isArray(record.gpsTracks)
    ? record.gpsTracks.map((entry) => {
        const row = entry as Record<string, unknown>;
        return {
          lat: toNumber(row.latitude),
          lng: toNumber(row.longitude),
          accuracy: row.accuracy ? `${toNumber(row.accuracy)}m` : "-",
          capturedAt: row.capturedAt ? String(row.capturedAt) : "-",
        };
      })
    : [];
  const firmwareUpdates = Array.isArray(record.firmwareUpdates)
    ? record.firmwareUpdates.map((entry) => {
        const row = entry as Record<string, unknown>;
        const release = row.release as { version?: string } | undefined;
        return {
          version: String(release?.version ?? "unknown"),
          status: String(row.status ?? "Scheduled"),
          startedAt: row.startedAt ? String(row.startedAt) : "-",
        };
      })
    : [];
  return { ...base, sosEvents, gpsTracks, firmwareUpdates };
}

export function toFieldDeviceView(record: Record<string, unknown>): FieldDeviceView {
  return {
    id: String(record.id ?? ""),
    publicDeviceId: String(record.publicDeviceId ?? ""),
    deviceName: String(record.deviceName ?? "Unknown device"),
    manufacturer: String(record.manufacturer ?? "-"),
    model: String(record.model ?? "-"),
    registrationStatus: String(record.registrationStatus ?? "PendingApproval"),
    assignedUserId: record.assignedUserId ? String(record.assignedUserId) : null,
    agencyId: record.agencyId ? String(record.agencyId) : null,
    assignedUnitId: record.assignedUnitId ? String(record.assignedUnitId) : null,
    countryCode: record.countryCode ? String(record.countryCode) : null,
    stateCode: record.stateCode ? String(record.stateCode) : null,
    lgaCode: record.lgaCode ? String(record.lgaCode) : null,
    appVersion: String(record.appVersion ?? "-"),
    androidVersion: String(record.androidVersion ?? "-"),
    lastSeen: record.lastSeenAt ? formatTime(String(record.lastSeenAt)) : "Never",
    batteryLevel: record.batteryLevel != null ? Number(record.batteryLevel) : null,
    networkType: String(record.networkType ?? "-"),
    isLost: record.isLost === true,
    isRevoked: record.isRevoked === true,
    requiresRePair: record.requiresRePair === true,
    isRootRiskDetected: record.isRootRiskDetected === true,
    approvedAt: record.approvedAt ? String(record.approvedAt) : null,
    registeredAt: record.registeredAt ? String(record.registeredAt) : "-",
    isBound: record.isBound === true,
    provisioningMode: String(record.provisioningMode ?? "SelfRegistration"),
    provisionedAt: record.provisionedAt ? String(record.provisionedAt) : null,
    provisionedById: record.provisionedById ? String(record.provisionedById) : null,
    permissionProfileId: record.permissionProfileId ? String(record.permissionProfileId) : null,
    assignedTeamId: record.assignedTeamId ? String(record.assignedTeamId) : null,
    operationalRole: record.operationalRole ? String(record.operationalRole) : null,
    deviceMode: record.deviceMode ? String(record.deviceMode) : null,
    activationPolicy: record.activationPolicy ? String(record.activationPolicy) : null,
    activationExpiresAt: record.activationExpiresAt ? String(record.activationExpiresAt) : null,
    reviewAt: record.reviewAt ? String(record.reviewAt) : null,
    notes: record.notes ? String(record.notes) : null,
    preProvisionStatus: record.preProvisionStatus ? String(record.preProvisionStatus) : null,
    inventoryAssetRef: record.inventoryAssetRef ? String(record.inventoryAssetRef) : null,
    permissionOverrides: Array.isArray(record.permissionOverrides) ? record.permissionOverrides.map(String) : [],
    permissionDenies: Array.isArray(record.permissionDenies) ? record.permissionDenies.map(String) : [],
  };
}

export function toFieldPermissionProfileView(record: Record<string, unknown>): FieldPermissionProfileView {
  return {
    id: String(record.id ?? ""),
    code: String(record.code ?? ""),
    name: String(record.name ?? ""),
    description: record.description ? String(record.description) : null,
    operationalRole: record.operationalRole ? String(record.operationalRole) : null,
    compatibleAgencyTypes: Array.isArray(record.compatibleAgencyTypes)
      ? record.compatibleAgencyTypes.map(String)
      : [],
    permissions: Array.isArray(record.permissions) ? record.permissions.map(String) : [],
    isSystem: record.isSystem === true,
    isActive: record.isActive !== false,
    disabledAt: record.disabledAt ? String(record.disabledAt) : null,
    disabledReason: record.disabledReason ? String(record.disabledReason) : null,
    createdAt: record.createdAt ? String(record.createdAt) : "-",
    updatedAt: record.updatedAt ? String(record.updatedAt) : "-",
  };
}

export function toAgencyView(record: Record<string, unknown>): AgencyView {
  const agencyType = String(record.agencyType ?? record.type ?? "");
  return {
    id: String(record.id ?? ""),
    code: String(record.code ?? ""),
    name: String(record.name ?? ""),
    shortName: record.shortName ? String(record.shortName) : null,
    agencyType,
    jurisdictionLevel: String(record.jurisdictionLevel ?? ""),
    countryCode: String(record.countryCode ?? ""),
    stateCode: record.stateCode ? String(record.stateCode) : null,
    lgaCode: record.lgaCode ? String(record.lgaCode) : null,
    capabilities: Array.isArray(record.capabilities) ? record.capabilities.map(String) : [],
    isActive: record.isActive !== false,
    status: String(record.status ?? (record.isActive === false ? "Inactive" : "Active")),
    isFieldOperationsEnabled: record.isFieldOperationsEnabled === true,
    isDispatchable: record.isDispatchable === true,
    isDroneEnabled: record.isDroneEnabled === true,
    isBroadcastAuthority: record.isBroadcastAuthority === true,
    isGovernment: record.isGovernment === true,
    isEmergencyResponder: record.isEmergencyResponder === true,
    parentAgencyId: record.parentAgencyId ? String(record.parentAgencyId) : null,
    jurisdictionId: record.jurisdictionId ? String(record.jurisdictionId) : null,
    phone: record.phone ? String(record.phone) : null,
    email: record.email ? String(record.email) : null,
    serviceCategories: Array.isArray(record.serviceCategories) ? record.serviceCategories.map(String) : [],
  };
}

export function toAgencyUnitView(record: Record<string, unknown>): AgencyUnitView {
  return {
    id: String(record.id ?? ""),
    agencyId: String(record.agencyId ?? ""),
    name: String(record.name ?? record.unitIdentifier ?? ""),
    unitIdentifier: String(record.unitIdentifier ?? ""),
    unitKind: String(record.unitKind ?? "Other"),
    parentUnitId: record.parentUnitId ? String(record.parentUnitId) : null,
    countryCode: record.countryCode ? String(record.countryCode) : null,
    stateCode: record.stateCode ? String(record.stateCode) : null,
    lgaCode: record.lgaCode ? String(record.lgaCode) : null,
    isActive: record.isActive !== false,
  };
}

export function toPairingSessionView(record: Record<string, unknown>): PairingSessionView {
  const device = record.device as Record<string, unknown> | null | undefined;
  const profile = (device?.user as { profile?: { firstName?: string; lastName?: string } } | undefined)?.profile;
  const owner = device ? [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Registered device" : "Awaiting registration";
  return {
    id: String(record.id),
    deviceId: String(record.deviceId),
    status: String(record.status ?? "pending"),
    expiresAt: record.expiresAt ? String(record.expiresAt) : "-",
    createdAt: record.createdAt ? String(record.createdAt) : "-",
    owner,
    connectivityMode: String((device?.connectivityMode as string | undefined) ?? "StandaloneCellular"),
    deviceInternalId: device ? String(device.id) : null,
    isDeviceRegistered: Boolean(device),
    isDeviceActive: Boolean(device?.isActive),
  };
}

export function toActivationHistoryView(record: Record<string, unknown>): ActivationHistoryView {
  return {
    id: String(record.id),
    action: String(record.action ?? "-"),
    entityType: String(record.entityType ?? "-"),
    entityId: String(record.entityId ?? "-"),
    createdAt: record.createdAt ? String(record.createdAt) : "-",
    metadata: record.metadata ? JSON.stringify(record.metadata) : "-",
  };
}

export function toFirmwareReleaseView(record: Record<string, unknown>): FirmwareReleaseView {
  const count = (record._count as { updates?: number } | undefined)?.updates;
  return {
    version: String(record.version ?? "0.0.0"),
    title: String(record.title ?? "Firmware release"),
    status: String(record.status ?? "Draft"),
    signature: record.signature ? "Valid" : "Pending",
    devices: typeof count === "number" ? count : 0,
    rollback: record.status === "Published" ? "Available" : "-",
  };
}

export function toDangerZoneView(record: Record<string, unknown>): DangerZoneView {
  const incident = record.incident as { title?: string } | undefined;
  return {
    id: String(record.id),
    incidentId: String(record.incidentId ?? record.incident_id ?? "-"),
    incidentTitle: incident?.title ?? String(record.publicMessage ?? "Incident"),
    status: String(record.status ?? "PendingVerification"),
    severity: String(record.severity ?? "P2Serious"),
    innerRadiusMeters: Number(record.innerRadiusMeters ?? record.inner_radius_meters ?? 0),
    warningRadiusMeters: Number(record.warningRadiusMeters ?? record.warning_radius_meters ?? 0),
    outerAwarenessRadiusMeters: Number(record.outerAwarenessRadiusMeters ?? record.outer_awareness_radius_meters ?? 0),
    confidence: Number(record.confidence ?? 0),
    publicMessage: String(record.publicMessage ?? record.public_message ?? "-"),
    avoidanceInstruction: String(record.avoidanceInstruction ?? record.avoidance_instruction ?? "-"),
    expiryTime: record.expiryTime ? String(record.expiryTime) : record.expiry_time ? String(record.expiry_time) : null,
    affectedCount: typeof record.affectedCount === "number" ? record.affectedCount : undefined,
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
    familyAlerted: record.familyNotifiedAt || record.familyContactsNotified ? "Yes" : "No",
    response: String((record.incident as { assignedAgencyId?: string } | undefined)?.assignedAgencyId ?? "Pending assignment"),
    gps: {
      lat: toNumber(record.latitude),
      lng: toNumber(record.longitude),
      accuracy: record.accuracy || record.accuracyMeters ? `${toNumber(record.accuracy ?? record.accuracyMeters)}m` : "-",
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
  const rawLocations = Array.isArray(record.locationUpdates) ? record.locationUpdates : [];
  const latest = rawLocations[0] as Record<string, unknown> | undefined;
  const startedAt = record.startedAt ? new Date(String(record.startedAt)) : new Date();
  const latitude = toNumber(latest?.latitude ?? incident.latitude);
  const longitude = toNumber(latest?.longitude ?? incident.longitude);
  const accuracyMeters = toNumber(latest?.accuracy ?? latest?.accuracyMeters, 0);
  const reporterProfile = ((incident.reporter as Record<string, unknown> | undefined)?.profile as Record<string, unknown> | undefined) ?? {};
  const reporterName = [reporterProfile.firstName, reporterProfile.lastName].filter(Boolean).join(" ");
  const trail = sanitizeLocationTrail(rawLocations.map((entry) => {
    const point = entry as Record<string, unknown>;
    return {
      latitude: toNumber(point.latitude),
      longitude: toNumber(point.longitude),
      accuracyMeters: point.accuracy != null ? toNumber(point.accuracy) : null,
      capturedAt: String(point.capturedAt ?? record.startedAt ?? new Date(0).toISOString()),
    };
  }));

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
    location: humanLocation([incident.address, incident.lga, incident.state, incident.country]),
    reporter: incident.isAnonymous ? "Anonymous reporter" : reporterName || (incident.reporterId ? `User ${String(incident.reporterId).slice(0, 8)}` : "Unknown reporter"),
    viewerScope: "Admin jurisdiction",
    signedLocationPath: `/live-video/sessions/${String(record.id)}/location/history`,
    locationHistory: trail.map((point) => ({
      ...point,
      time: formatTime(point.capturedAt),
      gps: `${point.latitude}, ${point.longitude}`,
      accuracy: point.accuracyMeters ? `${point.accuracyMeters}m` : "-",
    })),
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
    phone: String(record.phone ?? record.officialPhone ?? "-"),
    officialPhone: String(record.officialPhone ?? record.phone ?? "-"),
    emergencyPhone: String(record.emergencyPhone ?? "-"),
    address: String(record.address ?? "-"),
    country: String(record.country ?? jurisdiction.country ?? "-"),
    state: String(jurisdiction.state ?? record.state ?? "-"),
    lga: String(jurisdiction.lga ?? record.lga ?? "-"),
    latitude,
    longitude,
    agencyType: String(record.agency_type ?? record.agencyType ?? "police"),
    stationType: String(record.station_type ?? record.stationType ?? record.agency_type ?? record.agencyType ?? "police"),
    distance: distanceMeters ? `${Math.round(distanceMeters)} m` : "-",
    navigationUrl: String(record.navigationUrl ?? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`),
    verificationStatus: String(record.verification_status ?? record.verificationStatus ?? "Unverified"),
    isActive: record.is_active === false || record.isActive === false ? false : true,
    source: String(record.source ?? "-"),
    sourceReference: String(record.source_reference ?? record.sourceReference ?? "-"),
    googlePlaceId: record.google_place_id != null || record.googlePlaceId != null
      ? String(record.google_place_id ?? record.googlePlaceId)
      : null,
    verifiedAt: record.verified_at != null || record.verifiedAt != null
      ? String(record.verified_at ?? record.verifiedAt)
      : null,
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

export function toCommunityChannelView(
  record: Record<string, unknown>,
  communityId: string,
  communityName: string,
) {
  return {
    id: String(record.id),
    communityId,
    communityName,
    type: String(record.type ?? "General"),
    name: String(record.name ?? record.type ?? "Channel"),
  };
}

export function toChannelMessageView(record: Record<string, unknown>) {
  return {
    id: String(record.id),
    body: String(record.body ?? ""),
    senderId: String(record.senderId ?? "unknown"),
    createdAt: String(record.createdAt ?? ""),
  };
}

export function toContentReportView(record: Record<string, unknown>, communityName = "Community") {
  return {
    id: String(record.id),
    communityId: String(record.communityId),
    communityName,
    targetType: String(record.targetType ?? "Post"),
    targetId: String(record.targetId),
    reasonCode: String(record.reasonCode ?? "other"),
    note: String(record.note ?? ""),
    status: String(record.status ?? "Pending"),
    createdAt: String(record.createdAt ?? ""),
  };
}

export function toMissingPersonCaseView(record: Record<string, unknown>): MissingPersonCaseView {
  const incident = (record.incident ?? record) as Record<string, unknown>;
  const report = record.report as Record<string, unknown> | null | undefined;
  return {
    incidentId: String(incident.id),
    reportId: report?.id ? String(report.id) : undefined,
    fullName: String(report?.fullName ?? incident.title ?? "Unknown"),
    age: report?.age == null ? undefined : Number(report.age),
    gender: report?.gender ? String(report.gender) : undefined,
    description: String(report?.description ?? incident.description ?? ""),
    lastSeenAt: report?.lastSeenAt ? String(report.lastSeenAt) : undefined,
    lastSeenAddress: report?.lastSeenAddress ? String(report.lastSeenAddress) : undefined,
    reportStatus: String(report?.status ?? "Open"),
    incidentStatus: String(incident.status ?? "Submitted"),
    priority: priorityLabel(String(incident.priority ?? "P4GeneralSafety")),
    title: String(incident.title ?? "Missing person"),
    location: [report?.lastSeenAddress, incident.address, incident.lga, incident.state].filter(Boolean).join(", ") || "Unknown location",
    createdAt: incident.createdAt ? String(incident.createdAt) : undefined,
    latitude: report?.latitude == null ? toNumber(incident.latitude, NaN) || undefined : Number(report.latitude),
    longitude: report?.longitude == null ? toNumber(incident.longitude, NaN) || undefined : Number(report.longitude),
    evidence: toEvidenceItems(record),
  };
}

export function toStolenVehicleCaseView(record: Record<string, unknown>): StolenVehicleCaseView {
  const incident = (record.incident ?? record) as Record<string, unknown>;
  const report = record.report as Record<string, unknown> | null | undefined;
  const vehicle = report?.vehicle as Record<string, unknown> | undefined;
  return {
    incidentId: String(incident.id),
    reportId: report?.id ? String(report.id) : undefined,
    plateNumber: String(vehicle?.plateNumber ?? "Unknown"),
    vin: vehicle?.vin ? String(vehicle.vin) : undefined,
    make: String(vehicle?.make ?? "Unknown"),
    model: String(vehicle?.model ?? "Unknown"),
    color: vehicle?.color ? String(vehicle.color) : undefined,
    year: vehicle?.year == null ? undefined : Number(vehicle.year),
    lastSeenAt: report?.lastSeenAt ? String(report.lastSeenAt) : undefined,
    lastSeenArea: report?.lastSeenArea ? String(report.lastSeenArea) : undefined,
    reportStatus: String(report?.status ?? "Open"),
    incidentStatus: String(incident.status ?? "Submitted"),
    priority: priorityLabel(String(incident.priority ?? "P4GeneralSafety")),
    title: String(incident.title ?? "Stolen vehicle"),
    location: [report?.lastSeenArea, incident.address, incident.lga, incident.state].filter(Boolean).join(", ") || "Unknown location",
    createdAt: incident.createdAt ? String(incident.createdAt) : undefined,
    latitude: report?.latitude == null ? toNumber(incident.latitude, NaN) || undefined : Number(report.latitude),
    longitude: report?.longitude == null ? toNumber(incident.longitude, NaN) || undefined : Number(report.longitude),
    evidence: toEvidenceItems(record),
  };
}

export {
  toDroneDashboardView,
  toDroneDeviceView,
  toDroneMissionView,
  toDroneOperatorView,
  toDroneOperatorDetailView,
  toDroneEvidenceView,
  toDroneGeofenceView,
  toDroneNoFlyZoneView,
  toDroneFlightLogView,
  toDroneHealthView,
} from "./drone-mappers";
