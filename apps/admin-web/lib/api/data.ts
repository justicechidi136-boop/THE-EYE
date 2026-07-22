import { ApiError, apiRequest } from "./client";
import { getAccessToken } from "../session";
import {
  evidenceAccessEntriesForIncident,
  toAuditLogView,
  toBroadcastView,
  toCommunityPostView,
  toCommunityView,
  toDuplicateReportView,
  toWitnessConfirmationView,
  toFirmwareReleaseView,
  toIncidentView,
  toLiveVideoSessionView,
  toNotificationOperationView,
  toPatrolScheduleView,
  toResidentView,
  toPoliceStationView,
  toSmartwatchDeviceView,
  toSosEventView,
  toUserDirectoryEntry,
  toVolunteerView,
} from "../mappers";
import type {
  AuditLogView,
  BroadcastView,
  CommunityPostView,
  CommunityView,
  DuplicateReportView,
  EvidenceAccessEntry,
  WitnessConfirmationView,
  FirmwareReleaseView,
  Incident,
  LiveVideoSessionView,
  NotificationOperationView,
  PatrolScheduleView,
  ResidentView,
  PoliceStationView,
  SmartwatchDeviceView,
  SosEventView,
  UserDirectoryEntry,
  VolunteerView,
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

export async function fetchUsersDirectory(): Promise<UserDirectoryEntry[]> {
  return withToken(async (token) => {
    const rows = await fetchAllPages<Record<string, unknown>>("/users/directory", token);
    return rows.map(toUserDirectoryEntry);
  }, []);
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
    const response = await apiRequest<{ data: Record<string, unknown>[] }>("/neighborhood-watch/communities", { token });
    return response.data.map(toCommunityView);
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
    const response = await apiRequest<{ data: Record<string, unknown>[] }>("/neighborhood-watch/communities", { token });
    const residents: ResidentView[] = [];
    for (const community of response.data) {
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
    communities.slice(0, 10).map(async (community) => {
      const map = await apiRequest<{ data: Record<string, unknown> }>(
        `/neighborhood-watch/communities/${community.id}/map`,
        { token },
      );
      const patrols = Array.isArray(map.data.patrols) ? map.data.patrols : [];
      return patrols.map(toPatrolScheduleView);
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

export async function fetchSmartwatchDevice(id: string): Promise<SmartwatchDeviceView | null> {
  const devices = await fetchSmartwatchDevices();
  return devices.find((device) => device.id === id || device.deviceId === id) ?? null;
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

export async function fetchIncidentsByType(type: string): Promise<Incident[]> {
  const incidents = await fetchIncidents();
  return incidents.filter((incident) => incident.type === type);
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
