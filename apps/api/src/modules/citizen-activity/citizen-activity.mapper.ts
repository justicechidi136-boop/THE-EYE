import { BroadcastStatus, BroadcastType, IncidentStatus, IncidentType } from "@the-eye/shared";
import { LIVE_BROADCAST_STATUSES } from "../broadcasts/broadcasts.service";
import { isActiveIncidentStatus, isTerminalIncidentStatus } from "../incidents/incident-lifecycle";

export type ActivityKind =
  | "EmergencyReport"
  | "SOS"
  | "SilentSOS"
  | "MissingPersonBroadcast"
  | "StolenVehicleBroadcast";

export type ActivitySourceType = "incident" | "broadcast";

export type ActivityNavigationDestination = "active-emergency" | "incident-archive" | "broadcast-archive";

const cancelledIncidentStatuses = new Set<IncidentStatus>([
  IncidentStatus.CancelledByReporter,
  IncidentStatus.FalseReport,
  IncidentStatus.ExpiredAfterReview,
]);

const resolvedIncidentStatuses = new Set<IncidentStatus>([
  IncidentStatus.Resolved,
  IncidentStatus.Closed,
]);

const cancelledBroadcastStatuses = new Set<string>([
  BroadcastStatus.WithdrawnByAuthor,
  BroadcastStatus.Suspended,
  BroadcastStatus.Expired,
  BroadcastStatus.DeletedByAdmin,
  BroadcastStatus.Rejected,
]);

const resolvedBroadcastStatuses = new Set<string>([BroadcastStatus.Resolved]);

export function classifyIncidentKind(type: string, metadata: Record<string, unknown>): ActivityKind {
  const intake = String(metadata.intake ?? "");
  const silent = metadata.silent === true;
  if (intake === "sos_classification" || intake.includes("sos")) {
    return silent ? "SilentSOS" : "SOS";
  }
  if (type === IncidentType.Emergency || intake === "emergency_fast_path") {
    return "EmergencyReport";
  }
  return "EmergencyReport";
}

export function classifyBroadcastKind(type: string): ActivityKind {
  if (type === BroadcastType.StolenVehicle) return "StolenVehicleBroadcast";
  return "MissingPersonBroadcast";
}

export function incidentLifecycleBucket(status: IncidentStatus): "active" | "ended" | "resolved" | "cancelled" {
  if (status === IncidentStatus.Ended) return "ended";
  if (cancelledIncidentStatuses.has(status)) return "cancelled";
  if (resolvedIncidentStatuses.has(status)) return "resolved";
  if (isActiveIncidentStatus(status)) return "active";
  return isTerminalIncidentStatus(status) ? "resolved" : "active";
}

export function broadcastLifecycleBucket(status: string): "active" | "resolved" | "cancelled" {
  if (cancelledBroadcastStatuses.has(status)) return "cancelled";
  if (resolvedBroadcastStatuses.has(status)) return "resolved";
  if (LIVE_BROADCAST_STATUSES.has(status)) return "active";
  return "resolved";
}

export function resolveIncidentNavigation(status: IncidentStatus): ActivityNavigationDestination {
  return isActiveIncidentStatus(status) ? "active-emergency" : "incident-archive";
}

export function resolveBroadcastNavigation(_status: string): ActivityNavigationDestination {
  return "broadcast-archive";
}

export function buildBroadcastTimelinePreview(broadcast: {
  createdAt: Date;
  publishedAt: Date | null;
  updatedAt?: Date;
  resolvedAt: Date | null;
  withdrawnAt: Date | null;
  status: string;
}) {
  const entries: Array<{ label: string; at: string; type: string }> = [
    { label: "Broadcast created", at: broadcast.createdAt.toISOString(), type: "broadcast.created" },
  ];
  if (broadcast.publishedAt) {
    entries.push({
      label: "Broadcast published",
      at: broadcast.publishedAt.toISOString(),
      type: "broadcast.published",
    });
  }
  if (broadcast.withdrawnAt) {
    entries.push({
      label: "Broadcast withdrawn",
      at: broadcast.withdrawnAt.toISOString(),
      type: "broadcast.withdrawn",
    });
  }
  if (broadcast.resolvedAt) {
    entries.push({
      label: "Broadcast resolved",
      at: broadcast.resolvedAt.toISOString(),
      type: "broadcast.resolved",
    });
  } else if (resolvedBroadcastStatuses.has(String(broadcast.status))) {
    entries.push({
      label: "Broadcast resolved",
      at: (broadcast.resolvedAt ?? broadcast.createdAt).toISOString(),
      type: "broadcast.resolved",
    });
  }
  return entries.slice(-4);
}

export function latestTimelinePreviewEntry(
  preview: Array<{ label: string; at: string; type: string }>,
): { label: string; at: string } | undefined {
  if (!preview.length) return undefined;
  const latest = preview[preview.length - 1]!;
  return { label: latest.label, at: latest.at };
}

export function matchesActivitySection(
  section: string,
  item: {
    sourceType: ActivitySourceType;
    kind: ActivityKind;
    lifecycle: "active" | "ended" | "resolved" | "cancelled";
  },
) {
  if (section === "All") return true;
  if (section === "Active") return item.lifecycle === "active";
  if (section === "Ended") return item.lifecycle === "ended";
  if (section === "Resolved") return item.lifecycle === "resolved";
  if (section === "Cancelled") return item.lifecycle === "cancelled";
  if (section === "Broadcasts") return item.sourceType === "broadcast";
  if (section === "EmergencyReports") return item.kind === "EmergencyReport";
  if (section === "SOS") return item.kind === "SOS" || item.kind === "SilentSOS";
  if (section === "MissingPersons") return item.kind === "MissingPersonBroadcast";
  if (section === "StolenVehicles") return item.kind === "StolenVehicleBroadcast";
  return true;
}

export function encodeActivityCursor(sortAt: Date, sourceType: ActivitySourceType, id: string) {
  return Buffer.from(
    JSON.stringify({ sortAt: sortAt.toISOString(), sourceType, id }),
    "utf8",
  ).toString("base64url");
}

export function decodeActivityCursor(cursor?: string) {
  if (!cursor?.trim()) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      sortAt?: string;
      sourceType?: ActivitySourceType;
      id?: string;
    };
    if (!parsed.sortAt || !parsed.sourceType || !parsed.id) return null;
    const sortAt = new Date(parsed.sortAt);
    if (Number.isNaN(sortAt.getTime())) return null;
    return { sortAt, sourceType: parsed.sourceType, id: parsed.id };
  } catch {
    return null;
  }
}
