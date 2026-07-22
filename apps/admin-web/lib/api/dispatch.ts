import { apiRequest } from "./client";
import { getAccessToken } from "../session";

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
};

export type DispatchResponder = {
  id: string;
  displayName: string;
  availability: string;
  agencyId: string;
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
  return apiRequest<{ data: { incident: DispatchIncident; triage?: unknown; routingRecommendations?: unknown[]; assignments?: unknown[] } }>(
    `/dispatch/incidents/${id}`,
    { token },
  );
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
