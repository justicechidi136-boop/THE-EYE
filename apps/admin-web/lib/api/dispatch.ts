import { apiRequest } from "./client";
import { getAccessToken } from "../session";
import type { SlaTimerState } from "../dispatch/sla-display";

export type DispatchIncident = {
  id: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  latitude: number;
  longitude: number;
  country: string;
  state: string;
  lga: string;
  assignedAgencyId?: string | null;
  liveLocationUpdatedAt?: string | null;
  liveLocationStale?: boolean;
  submittedAt?: string;
  verificationStatus?: string | null;
  metadata?: Record<string, unknown>;
};

export type DispatchResponder = {
  id: string;
  displayName: string;
  availability: string;
  agencyId: string;
};

export type DispatchAssignment = {
  id: string;
  status: string;
  version: number;
  agencyId: string;
  responderId?: string | null;
  createdAt?: string;
  acceptedAt?: string | null;
  responder?: { displayName?: string | null } | null;
  agency?: { name?: string | null } | null;
};

export type DispatchIncidentDetail = {
  incident: DispatchIncident;
  triage?: Record<string, unknown> | null;
  routingRecommendations?: unknown[];
  assignments?: DispatchAssignment[];
  slaTimers?: SlaTimerState | null;
  silentIndicator?: boolean;
  distanceSource?: string | null;
};

export async function fetchDispatchIncidents(query?: Record<string, string | undefined>) {
  const token = await getAccessToken();
  if (!token) return { data: [] as DispatchIncident[], nextCursor: null, hasMore: false, limit: 0 };
  return apiRequest<{ data: DispatchIncident[]; nextCursor: string | null; hasMore: boolean; limit: number }>(
    "/dispatch/incidents",
    { token, query },
  );
}

export async function fetchDispatchIncident(id: string) {
  const token = await getAccessToken();
  if (!token) return null;
  return apiRequest<{ data: DispatchIncidentDetail }>(`/dispatch/incidents/${id}`, { token });
}

export async function fetchDispatchIncidentTimeline(id: string) {
  const token = await getAccessToken();
  if (!token) return { data: [] as Array<Record<string, unknown>> };
  return apiRequest<{ data: Array<Record<string, unknown>> }>(`/dispatch/incidents/${id}/timeline`, {
    token,
    query: { audience: "dispatcher" },
  });
}

export async function fetchDispatchResponders(query?: Record<string, string | undefined>) {
  const token = await getAccessToken();
  if (!token) return { data: [] as DispatchResponder[] };
  return apiRequest<{ data: DispatchResponder[] }>("/dispatch/responders", { token, query });
}

export async function assignDispatchIncident(id: string, body: Record<string, unknown>) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest(`/dispatch/incidents/${id}/assign`, {
    token,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function reassignDispatchIncident(id: string, body: Record<string, unknown>) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest(`/dispatch/incidents/${id}/reassign`, {
    token,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function escalateDispatchIncident(id: string, body: Record<string, unknown>) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest(`/dispatch/incidents/${id}/escalate`, {
    token,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateDispatchTriage(id: string, body: Record<string, unknown>) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest(`/dispatch/incidents/${id}/triage`, {
    token,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function requestDispatchInfo(id: string, reason: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest(`/dispatch/incidents/${id}/request-info`, {
    token,
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function fetchDispatchAssignment(id: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<{ data: DispatchAssignment }>(`/dispatch/assignments/${id}`, { token });
}

export async function updateResponderAvailability(id: string, body: Record<string, unknown>) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest(`/dispatch/responders/${id}/status`, {
    token,
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function fetchAssignmentLiveLocation(id: string) {
  const token = await getAccessToken();
  if (!token) return null;
  return apiRequest<{ data: Record<string, unknown> }>(`/dispatch/assignments/${id}/live-location`, { token });
}

export async function fetchCitizenLiveLocation(incidentId: string) {
  const token = await getAccessToken();
  if (!token) return null;
  return apiRequest<{ data: Record<string, unknown> }>(`/incidents/${incidentId}/live-location`, { token });
}
