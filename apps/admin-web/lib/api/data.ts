import { ApiError, apiRequest } from "./client";
import { getAccessToken } from "../session";
import {
  evidenceAccessEntriesForIncident,
  toAuditLogView,
  toBroadcastView,
  toBroadcastDetailView,
  toBroadcastReportView,
  toCommunityPostView,
  toCommunityView,
  toDuplicateReportView,
  toWitnessConfirmationView,
  toFirmwareReleaseView,
  toDangerZoneView,
  toIncidentView,
  toMissingPersonCaseView,
  toStolenVehicleCaseView,
  toLiveVideoSessionView,
  toNotificationOperationView,
  toPatrolScheduleView,
  toResidentView,
  toPoliceStationView,
  toSmartwatchDeviceView,
  toSmartwatchDeviceDetailView,
  toFieldDeviceView,
  toFieldPermissionProfileView,
  toPairingSessionView,
  toActivationHistoryView,
  toSosEventView,
  toUserDirectoryEntry,
  toVolunteerView,
  toCommunityChannelView,
  toChannelMessageView,
  toContentReportView,
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
} from "../mappers";
import { buildJurisdictionRows } from "../jurisdiction-tree";
import type {
  AuditLogView,
  BroadcastView,
  BroadcastDetailView,
  BroadcastReportView,
  BroadcastAnalyticsView,
  CommunityPostView,
  CommunityView,
  DuplicateReportView,
  EvidenceAccessEntry,
  WitnessConfirmationView,
  FirmwareReleaseView,
  DangerZoneView,
  Incident,
  MissingPersonCaseView,
  StolenVehicleCaseView,
  LiveVideoSessionView,
  NotificationOperationView,
  PatrolScheduleView,
  ResidentView,
  PoliceStationView,
  SmartwatchDeviceView,
  WatchOwnerSummaryView,
  WatchInventoryRowView,
  WatchOwnerDetailView,
  SmartwatchDeviceDetailView,
  FieldDeviceView,
  FieldPermissionProfileView,
  FieldPairingIssueView,
  FieldPermissionEffectivePreviewView,
  DroneDashboardView,
  DroneDeviceView,
  DroneMissionView,
  DroneOperatorView,
  DroneOperatorDetailView,
  DroneOperatorListStats,
  DroneEvidenceView,
  DroneGeofenceView,
  DroneNoFlyZoneView,
  DroneFlightLogView,
  DroneHealthView,
  PairingSessionView,
  ActivationHistoryView,
  SosEventView,
  UserDirectoryEntry,
  VolunteerView,
  VerificationDashboardView,
  CommunityChannelView,
  ChannelMessageView,
  ContentReportView,
  JurisdictionRowView,
} from "../types/admin-views";

export type PaginatedResponse<T> = {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};

const ADMIN_LIST_MAX_PAGES = 20;
const ADMIN_LIST_PAGE_SIZE = "100";

async function fetchAllPages<T>(
  path: string,
  token: string,
  query?: Record<string, string | undefined>,
  maxPages = ADMIN_LIST_MAX_PAGES,
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const response = await apiRequest<PaginatedResponse<T>>(path, {
      token,
      query: { ...query, cursor, limit: ADMIN_LIST_PAGE_SIZE },
    });
    all.push(...response.data);
    if (!response.hasMore || !response.nextCursor) break;
    cursor = response.nextCursor;
  }
  return all;
}

async function withToken<T>(fn: (token: string) => Promise<T>, fallback: T): Promise<T> {
  const token = await getAccessToken();
  if (!token) return fallback;
  try {
    return await fn(token);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return fallback;
    throw error;
  }
}

export async function fetchIncidents(filters: { status?: string; priority?: string; type?: string } = {}): Promise<Incident[]> {
  return withToken(async (token) => {
    const rows = await fetchAllPages<Record<string, unknown>>("/incidents", token, {
      status: filters.status,
      priority: filters.priority,
      type: filters.type,
    });
    return rows.map(toIncidentView);
  }, []);
}

export async function fetchIncidentsPage(
  query: Record<string, string | undefined> = {},
): Promise<PaginatedResponse<Incident>> {
  return withToken(async (token) => {
    const response = await apiRequest<PaginatedResponse<Record<string, unknown>>>("/incidents", {
      token,
      query: { ...query, limit: query.limit ?? ADMIN_LIST_PAGE_SIZE },
    });
    return {
      ...response,
      data: response.data.map(toIncidentView),
    };
  }, { data: [], nextCursor: null, hasMore: false, limit: 100 });
}

export async function fetchIncident(id: string): Promise<Incident | null> {
  return withToken(async (token) => {
    const incident = await apiRequest<Record<string, unknown>>(`/incidents/${id}`, { token });
    return toIncidentView(incident);
  }, null);
}

export async function fetchVerificationQueue(): Promise<Incident[]> {
  return withToken(async (token) => {
    const [dashboard, incidents] = await Promise.all([
      apiRequest<{ recent: Record<string, unknown>[] }>("/verification/dashboard", { token }),
      fetchAllPages<Record<string, unknown>>("/incidents", token),
    ]);
    const queuedStatuses = new Set(["Submitted", "Received", "Verifying"]);
    const queue = incidents
      .filter((item) => queuedStatuses.has(String(item.status)))
      .map(toIncidentView);
    if (queue.length) return queue;
    return dashboard.recent
      .map((entry) => entry.incident as Record<string, unknown> | undefined)
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map(toIncidentView);
  }, []);
}

export async function fetchBroadcasts(): Promise<BroadcastView[]> {
  return withToken(async (token) => {
    const rows = await fetchAllPages<Record<string, unknown>>("/broadcasts", token);
    return rows.map(toBroadcastView);
  }, []);
}

export type AdminBroadcastListQuery = {
  country?: string;
  state?: string;
  category?: string;
  status?: string;
  author?: string;
  cursor?: string;
  limit?: string;
};

export async function fetchAdminBroadcasts(
  query: AdminBroadcastListQuery = {},
): Promise<BroadcastView[]> {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: Record<string, unknown>[] }>("/admin/broadcasts", {
      token,
      query: {
        country: query.country,
        state: query.state,
        category: query.category,
        status: query.status,
        author: query.author,
        cursor: query.cursor,
        limit: query.limit ?? ADMIN_LIST_PAGE_SIZE,
      },
    });
    return response.data.map(toBroadcastView);
  }, []);
}

export async function fetchAdminBroadcast(id: string): Promise<BroadcastDetailView | null> {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: Record<string, unknown> }>(`/broadcasts/${encodeURIComponent(id)}`, { token });
    return toBroadcastDetailView(response.data);
  }, null);
}

export async function suspendBroadcast(id: string, reason?: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<Record<string, unknown>>(`/admin/broadcasts/${encodeURIComponent(id)}/suspend`, {
    method: "POST",
    token,
    body: JSON.stringify({ reason }),
  });
}

export async function restoreBroadcast(id: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<Record<string, unknown>>(`/admin/broadcasts/${encodeURIComponent(id)}/restore`, {
    method: "POST",
    token,
    body: JSON.stringify({}),
  });
}

export async function verifyBroadcast(id: string, note?: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<Record<string, unknown>>(`/admin/broadcasts/${encodeURIComponent(id)}/verify`, {
    method: "POST",
    token,
    body: JSON.stringify({ note }),
  });
}

export async function resolveBroadcast(id: string, note?: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<Record<string, unknown>>(`/admin/broadcasts/${encodeURIComponent(id)}/resolve`, {
    method: "POST",
    token,
    body: JSON.stringify({ note }),
  });
}

export async function deleteBroadcast(id: string, reason?: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<Record<string, unknown>>(`/admin/broadcasts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
    body: JSON.stringify({ reason }),
  });
}

export async function addOfficialBroadcastComment(id: string, body: string, pin?: boolean) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<Record<string, unknown>>(`/admin/broadcasts/${encodeURIComponent(id)}/comments`, {
    method: "POST",
    token,
    body: JSON.stringify({ body, pin }),
  });
}

export async function fetchBroadcastReports(id: string): Promise<BroadcastReportView[]> {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: Record<string, unknown>[] }>(
      `/admin/broadcasts/${encodeURIComponent(id)}/reports`,
      { token },
    );
    return response.data.map(toBroadcastReportView);
  }, []);
}

export async function fetchBroadcastAnalytics(): Promise<BroadcastAnalyticsView> {
  const broadcasts = await fetchAdminBroadcasts({ limit: "100" });
  const byStatus: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byAuthorLabel: Record<string, number> = {};
  let suspended = 0;
  let verified = 0;
  let totalReports = 0;
  let totalComments = 0;
  let citizenSubmitted = 0;

  for (const broadcast of broadcasts) {
    byStatus[broadcast.status] = (byStatus[broadcast.status] ?? 0) + 1;
    byCategory[broadcast.type] = (byCategory[broadcast.type] ?? 0) + 1;
    byAuthorLabel[broadcast.authorLabel] = (byAuthorLabel[broadcast.authorLabel] ?? 0) + 1;
    if (broadcast.status === "Suspended") suspended += 1;
    if (broadcast.adminVerified) verified += 1;
    if (broadcast.authorLabel === "Citizen" || broadcast.authorLabel === "Verified") citizenSubmitted += 1;
    totalReports += broadcast.reportCount;
    totalComments += broadcast.commentCount;
  }

  return {
    total: broadcasts.length,
    byStatus,
    byCategory,
    byAuthorLabel,
    suspended,
    verified,
    totalReports,
    totalComments,
    citizenSubmitted,
  };
}

export async function fetchUsersDirectory(): Promise<UserDirectoryEntry[]> {
  return withToken(async (token) => {
    const rows = await fetchAllPages<Record<string, unknown>>("/users/directory", token);
    return rows.map(toUserDirectoryEntry);
  }, []);
}

export async function fetchUsersDirectoryPage(
  query: Record<string, string | undefined> = {},
): Promise<PaginatedResponse<UserDirectoryEntry>> {
  return withToken(async (token) => {
    const response = await apiRequest<PaginatedResponse<Record<string, unknown>>>("/users/directory", {
      token,
      query: { ...query, limit: query.limit ?? ADMIN_LIST_PAGE_SIZE },
    });
    return {
      ...response,
      data: response.data.map(toUserDirectoryEntry),
    };
  }, { data: [], nextCursor: null, hasMore: false, limit: 100 });
}

export type SupportChatView = {
  id: string;
  reference: string;
  type: string;
  status: string;
  priority: string;
  subject: string;
  incidentId: string | null;
  incidentTitle: string | null;
  assignedAdminId: string | null;
  assignedAdminName: string | null;
  unreadAdmin: number;
  lastMessagePreview: string | null;
  hasAttachment: boolean;
  lastMessageAt: string | null;
  createdAt: string;
};

export async function fetchSupportChats(
  query: Record<string, string | undefined> = {},
): Promise<PaginatedResponse<SupportChatView>> {
  return withToken(async (token) => {
    return apiRequest<PaginatedResponse<SupportChatView>>("/support/admin/chats", {
      token,
      query: { ...query, limit: query.limit ?? "50" },
    });
  }, { data: [], nextCursor: null, hasMore: false, limit: 50 });
}

export async function fetchSupportChat(id: string): Promise<Record<string, unknown> | null> {
  return withToken(async (token) => apiRequest<Record<string, unknown>>(`/support/admin/chats/${id}`, { token }), null);
}

export type PendingKycRow = {
  id: string;
  userId: string;
  documentType: string;
  status: string;
  createdAt: string;
  citizen: {
    displayName: string;
    email: string | null;
    phone: string | null;
    country: string | null;
    state: string | null;
    lga: string | null;
  };
};

export async function fetchPendingKyc(): Promise<PendingKycRow[]> {
  return withToken(async (token) => {
    const rows = await fetchAllPages<PendingKycRow>("/users/kyc/pending", token);
    return rows;
  }, []);
}

export async function fetchCitizenDetail(userId: string): Promise<Record<string, unknown> | null> {
  return withToken(async (token) => {
    return apiRequest<Record<string, unknown>>(`/users/${userId}`, { token });
  }, null);
}

export async function fetchAuditLogs(filters?: {
  action?: string;
  entityType?: string;
  entityId?: string;
}): Promise<{ logs: AuditLogView[]; chainVerified: boolean }> {
  return withToken(async (token) => {
    const [logs, chain] = await Promise.all([
      fetchAllPages<Record<string, unknown>>("/audit", token, filters),
      apiRequest<{ verified: boolean }>("/audit/verify-chain", { token }),
    ]);
    const chainVerified = Boolean(chain.verified);
    return { logs: logs.map((log) => toAuditLogView(log, chainVerified)), chainVerified };
  }, { logs: [], chainVerified: false });
}

export async function fetchCommunities(): Promise<CommunityView[]> {
  return withToken(async (token) => {
    const rows = await fetchAllPages<Record<string, unknown>>("/neighborhood-watch/communities", token, { status: "all" });
    return rows.map(toCommunityView);
  }, []);
}

export async function fetchCommunitiesPage(
  query: Record<string, string | undefined> = {},
): Promise<PaginatedResponse<CommunityView>> {
  return withToken(async (token) => {
    const response = await apiRequest<PaginatedResponse<Record<string, unknown>>>("/neighborhood-watch/communities", {
      token,
      query: { ...query, status: query.status ?? "all", limit: query.limit ?? ADMIN_LIST_PAGE_SIZE },
    });
    return {
      ...response,
      data: response.data.map(toCommunityView),
    };
  }, { data: [], nextCursor: null, hasMore: false, limit: 100 });
}

export async function fetchCommunityBoundary(communityId: string) {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: { wkt: string | null; areaSqM: number | null } }>(
      `/neighborhood-watch/communities/${communityId}/boundary`,
      { token },
    );
    return response.data;
  }, null);
}

export async function fetchAdminMembershipsPage(
  query: Record<string, string | undefined> = {},
): Promise<PaginatedResponse<ResidentView>> {
  return withToken(async (token) => {
    const response = await apiRequest<PaginatedResponse<Record<string, unknown>>>("/neighborhood-watch/admin/memberships", {
      token,
      query: { ...query, limit: query.limit ?? ADMIN_LIST_PAGE_SIZE },
    });
    return {
      ...response,
      data: response.data.map((membership) => {
        const community = membership.community as { id?: string; name?: string } | undefined;
        return toResidentView(membership, {
          id: String(community?.id ?? membership.communityId ?? ""),
          name: String(community?.name ?? "Community"),
        });
      }),
    };
  }, { data: [], nextCursor: null, hasMore: false, limit: 100 });
}

export async function fetchPatrolDetail(scheduleId: string) {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: Record<string, unknown> }>(`/neighborhood-watch/patrols/${scheduleId}`, { token });
    return toPatrolScheduleView(response.data);
  }, null);
}

export async function fetchRawCommunities(): Promise<Record<string, unknown>[]> {
  return withToken(async (token) => fetchAllPages<Record<string, unknown>>("/neighborhood-watch/communities", token), []);
}

export async function fetchVerificationDashboard(): Promise<VerificationDashboardView> {
  return withToken(async (token) => {
    const dashboard = await apiRequest<VerificationDashboardView & { recent?: unknown[] }>("/verification/dashboard", { token });
    return {
      pending: dashboard.pending ?? 0,
      highConfidenceLast24h: dashboard.highConfidenceLast24h ?? 0,
      lowConfidenceLast24h: dashboard.lowConfidenceLast24h ?? 0,
    };
  }, { pending: 0, highConfidenceLast24h: 0, lowConfidenceLast24h: 0 });
}

export async function fetchCommunityVerificationAnalytics(): Promise<{
  requestsIssued: number;
  responsesReceived: number;
  suspiciousResponses: number;
  responseDistribution: Record<string, number>;
}> {
  return withToken(
    (token) =>
      apiRequest("/admin/community-verifications/analytics", { token }),
    { requestsIssued: 0, responsesReceived: 0, suspiciousResponses: 0, responseDistribution: {} },
  );
}

export async function fetchCommunityChannels(limit = 20): Promise<CommunityChannelView[]> {
  return withToken(async (token) => {
    const communities = await fetchAllPages<Record<string, unknown>>("/neighborhood-watch/communities", token);
    const channelGroups = await Promise.all(
      communities.slice(0, limit).map(async (community) => {
        const communityId = String(community.id);
        const communityName = String(community.name ?? "Community");
        try {
          const detail = await apiRequest<{ data: Record<string, unknown> }>(
            `/neighborhood-watch/communities/${communityId}`,
            { token },
          );
          const channels = Array.isArray(detail.data?.channels) ? detail.data.channels : [];
          return channels.map((channel) =>
            toCommunityChannelView(channel as Record<string, unknown>, communityId, communityName),
          );
        } catch {
          return [];
        }
      }),
    );
    return channelGroups.flat();
  }, []);
}

export async function fetchChannelMessages(channelId: string): Promise<ChannelMessageView[]> {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: Record<string, unknown>[] }>(
      `/neighborhood-watch/channels/${encodeURIComponent(channelId)}/messages`,
      { token },
    );
    return response.data.map(toChannelMessageView);
  }, []);
}

export async function fetchContentReports(): Promise<ContentReportView[]> {
  return withToken(async (token) => {
    const [reportsResponse, communities] = await Promise.all([
      apiRequest<{ data: Record<string, unknown>[] }>("/neighborhood-watch/reports", { token }),
      fetchAllPages<Record<string, unknown>>("/neighborhood-watch/communities", token),
    ]);
    const communityNames = new Map(communities.map((community) => [String(community.id), String(community.name ?? "Community")]));
    return reportsResponse.data.map((report) =>
      toContentReportView(report, communityNames.get(String(report.communityId)) ?? "Community"),
    );
  }, []);
}

export async function fetchJurisdictionRows(): Promise<JurisdictionRowView[]> {
  return withToken(async (token) => {
    const [communities, users] = await Promise.all([
      fetchAllPages<Record<string, unknown>>("/neighborhood-watch/communities", token),
      fetchAllPages<Record<string, unknown>>("/users/directory", token),
    ]);
    const stations = await fetchPoliceStations();
    const parsedUsers = users.map((user) => {
      const scope = String(user.scope ?? "");
      const parts = scope.split("/").map((part) => part.trim()).filter(Boolean);
      return {
        country: parts[0] ?? "—",
        state: parts[1] ?? "—",
        lga: parts[2] ?? "—",
      };
    });
    return buildJurisdictionRows(
      communities.map((community) => ({
        country: community.country as string | null | undefined,
        state: community.state as string | null | undefined,
        lga: community.lga as string | null | undefined,
        ward: community.ward as string | null | undefined,
      })),
      parsedUsers,
      stations,
    );
  }, []);
}

export async function fetchCommunityPosts(communityId?: string): Promise<CommunityPostView[]> {
  return withToken(async (token) => {
    const path = communityId
      ? `/neighborhood-watch/communities/${communityId}/feed`
      : "/neighborhood-watch/posts";
    const rows = await fetchAllPages<Record<string, unknown>>(path, token);
    return rows.map(toCommunityPostView);
  }, []);
}

export async function fetchCommunityDetail(communityId: string) {
  return withToken(async (token) => {
    const [communityResponse, posts, map, statisticsResponse] = await Promise.all([
      apiRequest<{ data: Record<string, unknown> }>(`/neighborhood-watch/communities/${communityId}`, { token }),
      fetchAllPages<Record<string, unknown>>(`/neighborhood-watch/communities/${communityId}/feed`, token),
      apiRequest<{ data: Record<string, unknown> }>(`/neighborhood-watch/communities/${communityId}/map`, { token }),
      apiRequest<{ data: Record<string, unknown> }>(`/neighborhood-watch/communities/${communityId}/statistics`, { token }).catch(() => ({ data: {} })),
    ]);
    const communityRecord = communityResponse.data ?? communityResponse;
    const mapData = map.data;
    const statistics = statisticsResponse.data ?? {};
    return {
      community: toCommunityView(communityRecord),
      posts: posts.map(toCommunityPostView),
      volunteers: (Array.isArray(mapData.volunteers) ? mapData.volunteers : []).map(toVolunteerView),
      patrols: (Array.isArray(mapData.patrols) ? mapData.patrols : []).map(toPatrolScheduleView),
      statistics,
    };
  }, null);
}

export async function fetchVolunteers(): Promise<VolunteerView[]> {
  const communities = await fetchCommunities();
  const token = await getAccessToken();
  if (!token || !communities.length) return [];
  const results = await Promise.all(
    communities.slice(0, 10).map(async (community) => {
      const map = await apiRequest<{ data: Record<string, unknown> }>(
        `/neighborhood-watch/communities/${community.id}/map`,
        { token },
      );
      const volunteers = Array.isArray(map.data.volunteers) ? map.data.volunteers : [];
      return volunteers.map(toVolunteerView);
    }),
  );
  return results.flat();
}

export async function fetchCommunityResidents(): Promise<ResidentView[]> {
  return withToken(async (token) => {
    const communities = await fetchAllPages<Record<string, unknown>>("/neighborhood-watch/communities", token);
    const residents: ResidentView[] = [];
    for (const community of communities) {
      const communityInfo = { id: String(community.id), name: String(community.name ?? "Community") };
      const memberships = Array.isArray(community.memberships) ? community.memberships : [];
      for (const membership of memberships) {
        residents.push(toResidentView(membership as Record<string, unknown>, communityInfo));
      }
    }
    return residents;
  }, []);
}

export async function fetchPendingMemberships(): Promise<ResidentView[]> {
  const residents = await fetchCommunityResidents();
  return residents.filter((r) => r.status === "Pending");
}

export async function fetchCsocMapMarkers() {
  const { fetchCsocMapLayers } = await import("../csoc/map-data");
  const layers = await fetchCsocMapLayers();
  return [
    ...layers.incidents,
    ...layers.posts,
    ...layers.volunteers,
    ...layers.patrols,
    ...layers.sos,
    ...layers.liveVideos,
    ...layers.policeStations,
    ...layers.devices,
  ];
}

export async function fetchPatrols(): Promise<PatrolScheduleView[]> {
  const communities = await fetchCommunities();
  const token = await getAccessToken();
  if (!token || !communities.length) return [];
  const results = await Promise.all(
    communities.slice(0, 20).map(async (community) => {
      try {
        const response = await apiRequest<{ data: Record<string, unknown>[] }>(
          `/neighborhood-watch/communities/${community.id}/patrols`,
          { token },
        );
        return response.data.map((patrol) => toPatrolScheduleView({ ...patrol, communityId: community.id, community: { name: community.name } }));
      } catch {
        const map = await apiRequest<{ data: Record<string, unknown> }>(
          `/neighborhood-watch/communities/${community.id}/map`,
          { token },
        );
        const patrols = Array.isArray(map.data.patrols) ? map.data.patrols : [];
        return patrols.map(toPatrolScheduleView);
      }
    }),
  );
  return results.flat();
}

export async function fetchSmartwatchDevices(): Promise<SmartwatchDeviceView[]> {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: Record<string, unknown>[] }>("/smartwatch/admin/devices", { token });
    return response.data.map(toSmartwatchDeviceView);
  }, []);
}

function toWatchOwnerSummaryView(record: Record<string, unknown>): WatchOwnerSummaryView {
  return {
    ownerKey: String(record.ownerKey ?? ""),
    ownerType: String(record.ownerType ?? ""),
    ownerId: record.ownerId ? String(record.ownerId) : null,
    ownerName: String(record.ownerName ?? ""),
    phone: record.phone ? String(record.phone) : null,
    email: record.email ? String(record.email) : null,
    organization: record.organization ? String(record.organization) : null,
    department: record.department ? String(record.department) : null,
    currentAssignee: record.currentAssignee ? String(record.currentAssignee) : null,
    totalWatches: Number(record.totalWatches ?? 0),
    onlineWatches: Number(record.onlineWatches ?? 0),
    offlineWatches: Number(record.offlineWatches ?? 0),
    lowBatteryWatches: Number(record.lowBatteryWatches ?? 0),
    sosActiveWatches: Number(record.sosActiveWatches ?? 0),
    unassignedWatches: Number(record.unassignedWatches ?? 0),
    lostStolenWatches: Number(record.lostStolenWatches ?? 0),
    replacementPendingWatches: Number(record.replacementPendingWatches ?? 0),
    retiredWatches: Number(record.retiredWatches ?? 0),
    lastDeviceActivity: record.lastDeviceActivity ? String(record.lastDeviceActivity) : null,
    accountStatus: record.accountStatus ? String(record.accountStatus) : null,
  };
}

function toWatchInventoryRowView(record: Record<string, unknown>): WatchInventoryRowView {
  return {
    id: String(record.id ?? ""),
    watchName: String(record.watchName ?? ""),
    deviceId: String(record.deviceId ?? ""),
    serialNumber: record.serialNumber ? String(record.serialNumber) : null,
    imei: record.imei ? String(record.imei) : null,
    eid: record.eid ? String(record.eid) : null,
    model: record.model ? String(record.model) : null,
    manufacturer: record.manufacturer ? String(record.manufacturer) : null,
    firmwareVersion: record.firmwareVersion ? String(record.firmwareVersion) : null,
    appVersion: record.appVersion ? String(record.appVersion) : null,
    currentOwner: String(record.currentOwner ?? ""),
    currentAssignee: record.currentAssignee ? String(record.currentAssignee) : null,
    organization: record.organization ? String(record.organization) : null,
    department: record.department ? String(record.department) : null,
    pairingStatus: String(record.pairingStatus ?? ""),
    ownershipStatus: String(record.ownershipStatus ?? ""),
    inventoryStatus: String(record.inventoryStatus ?? ""),
    onlineStatus: String(record.onlineStatus ?? ""),
    batteryLevel: record.batteryLevel != null ? Number(record.batteryLevel) : null,
    connectivityType: String(record.connectivityType ?? ""),
    lastSeen: record.lastSeen ? String(record.lastSeen) : null,
    lastSync: record.lastSync ? String(record.lastSync) : null,
    lastKnownState: record.lastKnownState ? String(record.lastKnownState) : null,
    lastKnownLga: record.lastKnownLga ? String(record.lastKnownLga) : null,
    lastSos: record.lastSos ? String(record.lastSos) : null,
    lastEmergencyAlert: record.lastEmergencyAlert ? String(record.lastEmergencyAlert) : null,
    lastLiveVideoSession: record.lastLiveVideoSession ? String(record.lastLiveVideoSession) : null,
  };
}

export async function fetchWatchOwnerSummaries(query: Record<string, string | undefined> = {}): Promise<PaginatedResponse<WatchOwnerSummaryView>> {
  return withToken(async (token) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    const path = `/watch-fleet/owners${params.size ? `?${params.toString()}` : ""}`;
    const response = await apiRequest<PaginatedResponse<Record<string, unknown>>>(path, { token });
    return {
      ...response,
      data: response.data.map(toWatchOwnerSummaryView),
    };
  }, { data: [], nextCursor: null, hasMore: false, limit: 50 });
}

export async function fetchWatchInventory(query: Record<string, string | undefined> = {}): Promise<PaginatedResponse<WatchInventoryRowView>> {
  return withToken(async (token) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    const path = `/watch-fleet/inventory${params.size ? `?${params.toString()}` : ""}`;
    const response = await apiRequest<PaginatedResponse<Record<string, unknown>>>(path, { token });
    return {
      ...response,
      data: response.data.map(toWatchInventoryRowView),
    };
  }, { data: [], nextCursor: null, hasMore: false, limit: 50 });
}

export async function fetchWatchOwnerDetail(ownerType: string, ownerId: string): Promise<WatchOwnerDetailView> {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: Record<string, unknown> }>(
      `/watch-fleet/owners/${encodeURIComponent(ownerType)}/${encodeURIComponent(ownerId)}`,
      { token },
    );
    const base = toWatchOwnerSummaryView(response.data);
    return {
      ...base,
      ownershipHistory: (response.data.ownershipHistory as unknown[]) ?? [],
      assignmentHistory: (response.data.assignmentHistory as unknown[]) ?? [],
      transferHistory: (response.data.transferHistory as unknown[]) ?? [],
      auditHistory: (response.data.auditHistory as unknown[]) ?? [],
      departments: (response.data.departments as unknown[]) ?? [],
    };
  }, {
    ownerKey: "",
    ownerType: "",
    ownerId: null,
    ownerName: "",
    phone: null,
    email: null,
    organization: null,
    department: null,
    currentAssignee: null,
    totalWatches: 0,
    onlineWatches: 0,
    offlineWatches: 0,
    lowBatteryWatches: 0,
    sosActiveWatches: 0,
    unassignedWatches: 0,
    lostStolenWatches: 0,
    replacementPendingWatches: 0,
    retiredWatches: 0,
    lastDeviceActivity: null,
    accountStatus: null,
    ownershipHistory: [],
    assignmentHistory: [],
    transferHistory: [],
    auditHistory: [],
    departments: [],
  });
}

export async function fetchSmartwatchDevice(id: string): Promise<SmartwatchDeviceView | null> {
  const detail = await fetchSmartwatchDeviceDetail(id);
  return detail;
}

export async function fetchSmartwatchDeviceDetail(id: string): Promise<SmartwatchDeviceDetailView | null> {
  return withToken(async (token) => {
    try {
      const response = await apiRequest<{ data: Record<string, unknown> }>(`/smartwatch/admin/devices/${encodeURIComponent(id)}`, { token });
      return toSmartwatchDeviceDetailView(response.data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }, null);
}

export async function fetchPairingSessions(): Promise<PairingSessionView[]> {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: Record<string, unknown>[] }>("/smartwatch/admin/pairing-sessions", { token });
    return response.data.map(toPairingSessionView);
  }, []);
}

export async function fetchActivationHistory(): Promise<ActivationHistoryView[]> {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: Record<string, unknown>[] }>("/smartwatch/admin/activation-history", { token });
    return response.data.map(toActivationHistoryView);
  }, []);
}

export async function fetchSosTracking(sosEventId: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<{ data: Record<string, unknown> }>(`/smartwatch/sos/${encodeURIComponent(sosEventId)}/tracking`, { token });
}

export async function issueSmartwatchActivation(input: { deviceId: string; ttlMinutes?: number; connectivityMode?: string }) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<{ data: Record<string, unknown> }>("/smartwatch/admin/activation-secrets", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export async function revokeSmartwatchPairingSession(deviceId: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<{ revoked: boolean; deviceId: string }>(`/smartwatch/admin/pairing-sessions/${encodeURIComponent(deviceId)}`, {
    method: "DELETE",
    token,
  });
}

export async function smartwatchDeviceAction(id: string, action: "activate" | "deactivate" | "remote-wipe") {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<{ data: Record<string, unknown> }>(`/smartwatch/devices/${encodeURIComponent(id)}/${action}`, {
    method: "PATCH",
    token,
  });
}

export async function fetchFieldDevices(query: Record<string, string | undefined> = {}): Promise<FieldDeviceView[]> {
  return withToken(async (token) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    const path = `/admin/field-devices${params.size ? `?${params.toString()}` : ""}`;
    const response = await apiRequest<{ data: Record<string, unknown>[] }>(path, { token });
    return response.data.map(toFieldDeviceView);
  }, []);
}

export async function fetchFieldDevice(id: string): Promise<FieldDeviceView | null> {
  return withToken(async (token) => {
    try {
      const response = await apiRequest<{ data: Record<string, unknown> }>(`/admin/field-devices/${encodeURIComponent(id)}`, { token });
      return toFieldDeviceView(response.data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }, null);
}

export type FieldOperationsMonitoringView = {
  counts: {
    activeShifts: number;
    activePatrols: number;
    activeCheckpoints: number;
    offlineOfficers: number;
    openBackupRequests?: number;
    activeSafetyAlerts?: number;
    revokedOrLostDevices?: number;
    syncBacklog?: number;
  };
  officers: Array<{
    officerId: string;
    displayName: string;
    status: string;
    batteryLevel: number | null;
    gpsStatus: string | null;
    latitude: number | null;
    longitude: number | null;
    activeAssignmentCount: number;
    isOffline: boolean;
    lastHeartbeatAt: string | null;
    appVersion?: string | null;
    offlineQueueDepth?: number;
    deadLetterCount?: number;
    riskFlags?: string[];
  }>;
  backupRequests?: Array<{
    id: string;
    requestType: string;
    status: string;
    priority: string;
    officerName: string;
    latitude: number | null;
    longitude: number | null;
    createdAt: string;
  }>;
  safetyAlerts?: Array<{
    id: string;
    alertType: string;
    status: string;
    officerName: string;
    latitude: number | null;
    longitude: number | null;
    createdAt: string;
  }>;
};

export async function fetchFieldOperationsMonitoring(query: Record<string, string | undefined> = {}): Promise<FieldOperationsMonitoringView | null> {
  return withToken(async (token) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    const path = `/admin/field-operations/monitoring${params.size ? `?${params.toString()}` : ""}`;
    const response = await apiRequest<{ data: FieldOperationsMonitoringView }>(path, { token });
    return response.data;
  }, null);
}

export type FieldDeviceAdminAction =
  | "approve"
  | "reject"
  | "suspend"
  | "restore"
  | "mark-lost"
  | "revoke"
  | "require-re-pair"
  | "force-sign-out";

export async function fieldDeviceAction(
  id: string,
  action: FieldDeviceAdminAction,
  body: { reason?: string; note?: string; assignedUserId?: string; assignedUnitId?: string } = {},
) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<{ data: Record<string, unknown> }>(`/admin/field-devices/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export type FieldLauncherPolicyView = {
  deviceMode: string;
  launcherEnabled: boolean;
  kioskEnabled: boolean;
  approvedApps: string[];
  settingsAccessLevel: string;
  maintenanceModeAllowed: boolean;
  emergencyDialerAllowed: boolean;
  browserAllowed: boolean;
  screenshotsAllowed: boolean;
  usbPolicy: string;
  autoLockMinutes: number;
  visibleModules: string[];
  role: string;
  policyVersion: number;
  deviceReference?: string | null;
  agencyId?: string | null;
};

export async function fetchFieldDevicePolicy(id: string): Promise<FieldLauncherPolicyView | null> {
  return withToken(async (token) => {
    try {
      return await apiRequest<FieldLauncherPolicyView>(
        `/admin/field-devices/${encodeURIComponent(id)}/policy`,
        { token },
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }, null);
}

export async function patchFieldDevicePolicy(id: string, body: Partial<FieldLauncherPolicyView>) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<FieldLauncherPolicyView>(`/admin/field-devices/${encodeURIComponent(id)}/policy`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export type PreProvisionFieldDeviceInput = {
  deviceName: string;
  operationalRole?: string;
  permissionProfileId?: string;
  assignedTeamId?: string;
  assignedUserId?: string;
  assignedUnitId?: string;
  agencyId?: string;
  countryCode?: string;
  stateCode?: string;
  lgaCode?: string;
  deviceMode?: string;
  activationPolicy?: string;
  activationExpiresAt?: string;
  reviewAt?: string;
  notes?: string;
  inventoryAssetRef?: string;
  permissionOverrides?: string[];
  permissionDenies?: string[];
};

export async function preprovisionFieldDevice(input: PreProvisionFieldDeviceInput): Promise<FieldDeviceView> {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  const response = await apiRequest<{ data: Record<string, unknown> }>("/admin/field-devices/preprovision", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
  return toFieldDeviceView(response.data);
}

export async function fetchFieldDeviceProvisioning(id: string): Promise<FieldDeviceView | null> {
  return withToken(async (token) => {
    try {
      const response = await apiRequest<{ data: Record<string, unknown> }>(
        `/admin/field-devices/${encodeURIComponent(id)}/provisioning`,
        { token },
      );
      return toFieldDeviceView(response.data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }, null);
}

export type UpdateFieldDeviceProvisioningInput = {
  operationalRole?: string;
  permissionProfileId?: string | null;
  assignedTeamId?: string | null;
  deviceMode?: string | null;
  activationPolicy?: string;
  activationExpiresAt?: string | null;
  reviewAt?: string | null;
  notes?: string | null;
  inventoryAssetRef?: string | null;
  permissionOverrides?: string[];
  permissionDenies?: string[];
};

export async function updateFieldDeviceProvisioning(
  id: string,
  input: UpdateFieldDeviceProvisioningInput,
): Promise<FieldDeviceView> {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  const response = await apiRequest<{ data: Record<string, unknown> }>(
    `/admin/field-devices/${encodeURIComponent(id)}/provisioning`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(input),
    },
  );
  return toFieldDeviceView(response.data);
}

export async function issueFieldDevicePairingCode(
  id: string,
  input: { ttlMinutes?: number } = {},
): Promise<FieldPairingIssueView> {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  const response = await apiRequest<{ data: FieldPairingIssueView }>(
    `/admin/field-devices/${encodeURIComponent(id)}/pairing-code`,
    { method: "POST", token, body: JSON.stringify(input) },
  );
  return response.data;
}

export async function regenerateFieldDevicePairingCode(
  id: string,
  input: { ttlMinutes?: number } = {},
): Promise<FieldPairingIssueView> {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  const response = await apiRequest<{ data: FieldPairingIssueView }>(
    `/admin/field-devices/${encodeURIComponent(id)}/regenerate-pairing`,
    { method: "POST", token, body: JSON.stringify(input) },
  );
  return response.data;
}

export async function cancelFieldDevicePairing(
  id: string,
  input: { reason?: string } = {},
): Promise<{ cancelled: number }> {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  const response = await apiRequest<{ data: { cancelled: number } }>(
    `/admin/field-devices/${encodeURIComponent(id)}/cancel-pairing`,
    { method: "POST", token, body: JSON.stringify(input) },
  );
  return response.data;
}

export async function fetchFieldPermissionProfiles(
  query: { isActive?: string; operationalRole?: string } = {},
): Promise<FieldPermissionProfileView[]> {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: Record<string, unknown>[] }>("/admin/field-permission-profiles", {
      token,
      query,
    });
    return response.data.map(toFieldPermissionProfileView);
  }, []);
}

export async function fetchFieldPermissionProfile(id: string): Promise<FieldPermissionProfileView | null> {
  return withToken(async (token) => {
    try {
      const response = await apiRequest<{ data: Record<string, unknown> }>(
        `/admin/field-permission-profiles/${encodeURIComponent(id)}`,
        { token },
      );
      return toFieldPermissionProfileView(response.data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }, null);
}

export type CreateFieldPermissionProfileInput = {
  code: string;
  name: string;
  description?: string;
  operationalRole?: string;
  permissions: string[];
};

export async function createFieldPermissionProfile(
  input: CreateFieldPermissionProfileInput,
): Promise<FieldPermissionProfileView> {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  const response = await apiRequest<{ data: Record<string, unknown> }>("/admin/field-permission-profiles", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
  return toFieldPermissionProfileView(response.data);
}

export type UpdateFieldPermissionProfileInput = {
  name?: string;
  description?: string;
  operationalRole?: string;
  permissions?: string[];
};

export async function updateFieldPermissionProfile(
  id: string,
  input: UpdateFieldPermissionProfileInput,
): Promise<FieldPermissionProfileView> {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  const response = await apiRequest<{ data: Record<string, unknown> }>(
    `/admin/field-permission-profiles/${encodeURIComponent(id)}`,
    { method: "PATCH", token, body: JSON.stringify(input) },
  );
  return toFieldPermissionProfileView(response.data);
}

export async function disableFieldPermissionProfile(
  id: string,
  input: { reason?: string } = {},
): Promise<FieldPermissionProfileView> {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  const response = await apiRequest<{ data: Record<string, unknown> }>(
    `/admin/field-permission-profiles/${encodeURIComponent(id)}/disable`,
    { method: "POST", token, body: JSON.stringify(input) },
  );
  return toFieldPermissionProfileView(response.data);
}

export async function fetchFieldPermissionEffectivePreview(query: {
  profileId?: string;
  overrides?: string;
  denies?: string;
}): Promise<FieldPermissionEffectivePreviewView | null> {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: FieldPermissionEffectivePreviewView }>(
      "/admin/field-permissions/effective-preview",
      { token, query },
    );
    return response.data;
  }, null);
}

export async function publishSmartwatchFirmware(input: {
  version: string;
  title: string;
  releaseNotes?: string;
  downloadUrl: string;
  fileHash: string;
  signature: string;
  status?: string;
}) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<{ data: Record<string, unknown> }>("/smartwatch/admin/firmware", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export async function fetchSosEvents(): Promise<SosEventView[]> {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: Record<string, unknown>[] }>("/smartwatch/admin/sos-events", { token });
    return response.data.map(toSosEventView);
  }, []);
}

export async function fetchFirmwareReleases(): Promise<FirmwareReleaseView[]> {
  return withToken(async (token) => {
    try {
      const response = await apiRequest<{ data: Record<string, unknown>[] }>("/smartwatch/admin/firmware", { token });
      return response.data.map(toFirmwareReleaseView);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return [];
      throw error;
    }
  }, []);
}

export async function fetchDangerZones(): Promise<DangerZoneView[]> {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: Record<string, unknown>[] }>("/danger-zones", { token });
    return response.data.map(toDangerZoneView);
  }, []);
}

export async function fetchNotificationOperations(): Promise<NotificationOperationView[]> {
  return withToken(async (token) => {
    const rows = await fetchAllPages<Record<string, unknown>>("/notifications", token);
    return rows.map(toNotificationOperationView);
  }, []);
}

export type NotificationDeliveryDiagnostics = {
  queue: Record<string, unknown> | null;
  worker: Record<string, unknown> | null;
  fcm: Record<string, unknown> | null;
  summary: Record<string, number>;
  recentFailures: Record<string, unknown>[];
  generatedAt: string;
};

export type BroadcastSchedulerHealth = {
  active: boolean;
  lastRunAt: string | null;
  dueCount: number;
  claimedCount: number;
  dispatchFailures: number;
  staleScheduledCount: number;
  nextScheduledAt: string | null;
  queue: Record<string, unknown>;
};

export async function fetchBroadcastSchedulerHealth(): Promise<BroadcastSchedulerHealth | null> {
  return withToken(async (token) => {
    return apiRequest<BroadcastSchedulerHealth>("/broadcasts/admin/scheduler-health", { token });
  }, null);
}

export async function fetchNotificationDeliveryDiagnostics(): Promise<NotificationDeliveryDiagnostics | null> {
  return withToken(async (token) => {
    return apiRequest<NotificationDeliveryDiagnostics>("/notifications/admin/delivery-operations", { token });
  }, null);
}

export async function approveBroadcast(id: string, note?: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<Record<string, unknown>>(`/broadcasts/${id}/approve`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ note }),
  });
}

export async function rejectBroadcast(id: string, reason: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<Record<string, unknown>>(`/broadcasts/${id}/reject`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ reason }),
  });
}

export async function dispatchBroadcast(id: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<Record<string, unknown>>(`/broadcasts/${id}/dispatch`, {
    method: "POST",
    token,
    body: JSON.stringify({}),
  });
}

export async function scheduleBroadcast(id: string, scheduledAt: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<Record<string, unknown>>(`/broadcasts/${id}/schedule`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ scheduledAt }),
  });
}

export async function cancelBroadcast(id: string, reason?: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<Record<string, unknown>>(`/broadcasts/${id}/cancel`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ reason }),
  });
}

export async function retryBroadcast(id: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<Record<string, unknown>>(`/broadcasts/${id}/retry`, {
    method: "POST",
    token,
    body: JSON.stringify({}),
  });
}

export async function fetchBroadcastProgress(id: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<Record<string, unknown>>(`/broadcasts/${id}/progress`, { token });
}

export async function estimateBroadcastRecipients(id: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<Record<string, unknown>>(`/broadcasts/${id}/estimate-recipients`, { token });
}

export async function fetchLiveVideoSessions(): Promise<LiveVideoSessionView[]> {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: Record<string, unknown>[] }>("/live-video/sessions/active", { token });
    return response.data.map(toLiveVideoSessionView);
  }, []);
}

export async function fetchLiveVideoAdminToken(sessionId: string) {
  return withToken(async (token) => {
    return apiRequest<{
      data: Record<string, unknown>;
      livekit: { url: string; roomName: string; token: string };
    }>(`/live-video/sessions/${sessionId}/admin-token`, {
      token,
      method: "POST",
      body: JSON.stringify({}),
    });
  }, { data: {}, livekit: { url: "", roomName: "", token: "" } });
}

export async function fetchLiveVideoLatestLocation(sessionId: string) {
  return withToken(async (token) => {
    return apiRequest<{
      data?: Record<string, unknown>;
      evidenceOverlay?: Record<string, unknown>;
      signedOpenLocationUrl?: string | null;
      realtime?: { pollIntervalMs?: number };
    }>(`/live-video/sessions/${sessionId}/location/latest`, { token });
  }, {});
}

export async function fetchPoliceStations(query?: {
  q?: string;
  state?: string;
  lga?: string;
  agencyType?: string;
}): Promise<PoliceStationView[]> {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: Record<string, unknown>[] }>("/police-stations/search", {
      token,
      query,
    });
    return response.data.map(toPoliceStationView);
  }, []);
}

export async function fetchPoliceStation(id: string): Promise<PoliceStationView | null> {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: Record<string, unknown> }>(`/police-stations/${id}`, { token });
    return toPoliceStationView(response.data);
  }, null);
}

export async function createPoliceStation(input: Record<string, unknown>) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  const response = await apiRequest<{ data: Record<string, unknown> }>("/police-stations", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
  return toPoliceStationView(response.data);
}

export async function updatePoliceStation(id: string, input: Record<string, unknown>) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  const response = await apiRequest<{ data: Record<string, unknown> }>(`/police-stations/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(input),
  });
  return toPoliceStationView(response.data);
}

export async function verifyPoliceStation(id: string, input: Record<string, unknown>) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  const response = await apiRequest<{ data: Record<string, unknown> }>(`/police-stations/${id}/verify`, {
    method: "PATCH",
    token,
    body: JSON.stringify(input),
  });
  return toPoliceStationView(response.data);
}

export async function checkPoliceStationDuplicates(input: Record<string, unknown>) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  const response = await apiRequest<{ data: Record<string, unknown>[] }>("/police-stations/check-duplicates", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function fetchIncidentsByType(type: string): Promise<Incident[]> {
  const page = await fetchIncidentsPage({ type, limit: "100" });
  return page.data;
}

export async function fetchMissingPersonsPage(
  query: Record<string, string | undefined> = {},
): Promise<PaginatedResponse<MissingPersonCaseView>> {
  return withToken(async (token) => {
    const response = await apiRequest<PaginatedResponse<Record<string, unknown>>>("/admin/missing-persons", {
      token,
      query: { ...query, limit: query.limit ?? ADMIN_LIST_PAGE_SIZE },
    });
    return {
      ...response,
      data: response.data.map(toMissingPersonCaseView),
    };
  }, { data: [], nextCursor: null, hasMore: false, limit: 100 });
}

export async function fetchStolenVehiclesPage(
  query: Record<string, string | undefined> = {},
): Promise<PaginatedResponse<StolenVehicleCaseView>> {
  return withToken(async (token) => {
    const response = await apiRequest<PaginatedResponse<Record<string, unknown>>>("/admin/stolen-vehicles", {
      token,
      query: { ...query, limit: query.limit ?? ADMIN_LIST_PAGE_SIZE },
    });
    return {
      ...response,
      data: response.data.map(toStolenVehicleCaseView),
    };
  }, { data: [], nextCursor: null, hasMore: false, limit: 100 });
}

export async function fetchMissingPersonCase(incidentId: string): Promise<MissingPersonCaseView | null> {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: Record<string, unknown> }>(`/admin/missing-persons/${incidentId}`, { token });
    return toMissingPersonCaseView(response.data);
  }, null);
}

export async function fetchStolenVehicleCase(incidentId: string): Promise<StolenVehicleCaseView | null> {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: Record<string, unknown> }>(`/admin/stolen-vehicles/${incidentId}`, { token });
    return toStolenVehicleCaseView(response.data);
  }, null);
}

export async function fetchIncidentDuplicates(incidentId: string): Promise<DuplicateReportView[]> {
  return withToken(async (token) => {
    const rows = await apiRequest<Record<string, unknown>[]>(`/verification/incidents/${incidentId}/duplicates`, { token });
    return rows.map(toDuplicateReportView);
  }, []);
}

export async function fetchWitnessConfirmations(incidentId: string): Promise<WitnessConfirmationView[]> {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: Record<string, unknown>[] }>(`/verification/incidents/${incidentId}/confirmations`, { token });
    return (response.data ?? []).map(toWitnessConfirmationView);
  }, []);
}

export async function requestCrowdConfirmation(
  incidentId: string,
  input: { limit?: number; radiusMeters?: number } = {},
): Promise<Record<string, unknown>> {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<Record<string, unknown>>(`/verification/incidents/${incidentId}/crowd-request`, {
    token,
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchEvidenceAccessLogs(incidentId: string): Promise<EvidenceAccessEntry[]> {
  return withToken(async (token) => {
    const [viewed, downloaded] = await Promise.all([
      fetchAllPages<Record<string, unknown>>("/audit", token, { action: "evidence.viewed" }),
      fetchAllPages<Record<string, unknown>>("/audit", token, { action: "evidence.downloaded" }),
    ]);
    return evidenceAccessEntriesForIncident(incidentId, [...viewed, ...downloaded]);
  }, []);
}

export type CreateBroadcastInput = {
  type: string;
  title: string;
  body: string;
  priority: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  targetAreaWkt?: string;
};

export type SendNotificationInput = {
  title: string;
  body: string;
  type: string;
  priority?: string;
  channels?: string[];
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  userId?: string;
  adminUserId?: string;
};

export async function createBroadcast(input: CreateBroadcastInput) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<Record<string, unknown>>("/broadcasts", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export async function sendNotification(input: SendNotificationInput) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<Record<string, unknown>>("/notifications/send", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export type WatchNotificationAnalytics = {
  scope?: Record<string, string | undefined> | null;
  totals: Record<string, number>;
  events: Array<Record<string, unknown>>;
};

export type WatchFeatureFlagsResponse = {
  flags: Record<string, boolean>;
  validation?: {
    valid: boolean;
    issues: Array<{ code: string; message: string; severity: string; flags: string[] }>;
  };
};

export async function fetchWatchNotificationAnalytics(query?: {
  from?: string;
  to?: string;
  language?: string;
  country?: string;
  state?: string;
  lga?: string;
  channel?: string;
  alertCode?: string;
  deliveryStatus?: string;
  acknowledged?: string;
}) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<WatchNotificationAnalytics>("/admin/watch-notifications/analytics", {
    token,
    query,
  });
}

export async function fetchWatchFeatureFlags() {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<WatchFeatureFlagsResponse>("/admin/watch-notifications/feature-flags", {
    token,
  });
}

export async function sendStagingWatchTestAlert(input: {
  userId: string;
  deviceId?: string;
  alertCode?: string;
  languageHint?: string;
  priority?: "CRITICAL" | "HIGH" | "MEDIUM";
  channelMode?: "auto" | "phone_relay" | "watch_push" | "both";
  connectivityModeOverride?: "PairedPhone" | "StandaloneCellular" | "Standalone";
}) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<Record<string, unknown>>("/admin/watch-notifications/staging/test-alert", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export async function fetchDroneDashboard(): Promise<DroneDashboardView> {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  const response = await apiRequest<{ data: Record<string, unknown> }>("/drone-surveillance/admin/dashboard", { token });
  return toDroneDashboardView(response.data);
}

export async function fetchDroneFleet(): Promise<DroneDeviceView[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const response = await apiRequest<{ data: Record<string, unknown>[] }>("/drone-surveillance/admin/fleet", { token });
  return (response.data ?? []).map(toDroneDeviceView);
}

export async function fetchDroneMissions(status?: string): Promise<DroneMissionView[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const response = await apiRequest<{ data: Record<string, unknown>[] }>("/drone-surveillance/admin/missions", {
    token,
    query: status ? { status } : undefined,
  });
  return (response.data ?? []).map(toDroneMissionView);
}

export async function fetchDroneMission(id: string): Promise<DroneMissionView | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const response = await apiRequest<{ data: Record<string, unknown> }>(`/drone-surveillance/admin/missions/${encodeURIComponent(id)}`, { token });
    return toDroneMissionView(response.data);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function fetchDroneLiveGps(): Promise<DroneMissionView[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const response = await apiRequest<{ data: Record<string, unknown>[] }>("/drone-surveillance/admin/live-gps", { token });
  return (response.data ?? []).map(toDroneMissionView);
}

export async function fetchDroneLiveVideoMissions(): Promise<DroneMissionView[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const response = await apiRequest<{ data: Record<string, unknown>[] }>("/drone-surveillance/admin/live-video", { token });
  return (response.data ?? []).map(toDroneMissionView);
}

export async function fetchDroneFlightHistory(): Promise<DroneMissionView[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const response = await apiRequest<{ data: Record<string, unknown>[] }>("/drone-surveillance/admin/flight-history", { token });
  return (response.data ?? []).map(toDroneMissionView);
}

export async function fetchDroneIncidentMissions(): Promise<DroneMissionView[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const response = await apiRequest<{ data: Record<string, unknown>[] }>("/drone-surveillance/admin/incident-missions", { token });
  return (response.data ?? []).map(toDroneMissionView);
}

export type DroneOperatorsPageQuery = {
  cursor?: string;
  limit?: string;
  q?: string;
  operatorRole?: string;
  accountStatus?: string;
  availabilityStatus?: string;
  country?: string;
  state?: string;
  lga?: string;
  licenceWarningLevel?: string;
};

export type DroneOperatorsPageResponse = PaginatedResponse<DroneOperatorView> & {
  stats: DroneOperatorListStats;
};

function toDroneOperatorListStats(value: unknown): DroneOperatorListStats {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    total: Number(raw.total ?? 0),
    available: Number(raw.available ?? 0),
    onMission: Number(raw.onMission ?? 0),
    pending: Number(raw.pending ?? raw.pendingVerification ?? 0),
    expiredLicences: Number(raw.expiredLicences ?? 0),
    certsExpiring: Number(raw.certsExpiring ?? raw.certsExpiring30d ?? 0),
    suspended: Number(raw.suspended ?? 0),
  };
}

export async function fetchDroneOperatorsPage(query: DroneOperatorsPageQuery = {}): Promise<DroneOperatorsPageResponse> {
  const token = await getAccessToken();
  if (!token) {
    return {
      data: [],
      nextCursor: null,
      hasMore: false,
      limit: Number(query.limit ?? 25),
      stats: toDroneOperatorListStats(null),
    };
  }
  const response = await apiRequest<{
    data: Record<string, unknown>[];
    nextCursor?: string | null;
    hasMore?: boolean;
    limit?: number;
    stats?: Record<string, unknown>;
  }>("/drone-surveillance/admin/operators", { token, query });
  return {
    data: (response.data ?? []).map(toDroneOperatorView),
    nextCursor: response.nextCursor ?? null,
    hasMore: Boolean(response.hasMore),
    limit: Number(response.limit ?? query.limit ?? 25),
    stats: toDroneOperatorListStats(response.stats),
  };
}

export async function fetchDroneOperators(query: DroneOperatorsPageQuery = {}): Promise<DroneOperatorView[]> {
  const page = await fetchDroneOperatorsPage(query);
  return page.data;
}

export async function fetchDroneOperator(id: string): Promise<DroneOperatorDetailView | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const response = await apiRequest<{ data: Record<string, unknown> }>(
      `/drone-surveillance/admin/operators/${encodeURIComponent(id)}`,
      { token },
    );
    return toDroneOperatorDetailView(response.data);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function createDroneOperator(input: Record<string, unknown>) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  const response = await apiRequest<{ data: Record<string, unknown> }>("/drone-surveillance/admin/operators", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
  return toDroneOperatorDetailView(response.data);
}

export async function updateDroneOperator(id: string, input: Record<string, unknown>) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  const response = await apiRequest<{ data: Record<string, unknown> }>(`/drone-surveillance/admin/operators/${encodeURIComponent(id)}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(input),
  });
  return toDroneOperatorDetailView(response.data);
}

export async function updateDroneOperatorStatus(
  id: string,
  input: { accountStatus?: string; availabilityStatus?: string; isActive?: boolean },
) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  const response = await apiRequest<{ data: Record<string, unknown> }>(
    `/drone-surveillance/admin/operators/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(input),
    },
  );
  return toDroneOperatorDetailView(response.data);
}

export async function fetchDroneHealth(): Promise<DroneHealthView[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const response = await apiRequest<{ data: Record<string, unknown>[] }>("/drone-surveillance/admin/health", { token });
  return (response.data ?? []).map(toDroneHealthView);
}

export async function fetchDroneEvidence(): Promise<DroneEvidenceView[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const response = await apiRequest<{ data: Record<string, unknown>[] }>("/drone-surveillance/admin/evidence", { token });
  return (response.data ?? []).map(toDroneEvidenceView);
}

export async function fetchDroneFlightLogs(): Promise<DroneFlightLogView[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const response = await apiRequest<{ data: Record<string, unknown>[] }>("/drone-surveillance/admin/flight-logs", { token });
  return (response.data ?? []).map(toDroneFlightLogView);
}

export async function fetchDroneGeofences(): Promise<DroneGeofenceView[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const response = await apiRequest<{ data: Record<string, unknown>[] }>("/drone-surveillance/admin/geofences", { token });
  return (response.data ?? []).map(toDroneGeofenceView);
}

export async function fetchDroneNoFlyZones(): Promise<DroneNoFlyZoneView[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const response = await apiRequest<{ data: Record<string, unknown>[] }>("/drone-surveillance/admin/no-fly-zones", { token });
  return (response.data ?? []).map(toDroneNoFlyZoneView);
}

export async function launchDroneMissionFromIncident(input: {
  incidentId: string;
  droneId?: string;
  title?: string;
  description?: string;
  priority?: string;
}) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<{ data: Record<string, unknown> }>("/drone-surveillance/admin/missions/from-incident", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export {
  listAgencies,
  fetchAgency,
  createAgency,
  updateAgency,
  activateAgency,
  deactivateAgency,
  listAgencyUnits,
  type ListAgenciesQuery,
  type CreateAgencyInput,
  type UpdateAgencyInput,
} from "./agencies";
