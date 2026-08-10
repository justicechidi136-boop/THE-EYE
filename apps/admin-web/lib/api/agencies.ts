import { ApiError, apiRequest } from "./client";
import { getAccessToken } from "../session";
import { toAgencyUnitView, toAgencyView } from "../mappers";
import type { AgencyUnitView, AgencyView } from "../types/admin-views";

export type ListAgenciesQuery = {
  countryCode?: string;
  stateCode?: string;
  lgaCode?: string;
  agencyType?: string;
  capability?: string;
  isDispatchable?: string;
  isFieldOperationsEnabled?: string;
  isActive?: string;
  search?: string;
};

export type CreateAgencyInput = {
  code: string;
  name: string;
  shortName?: string;
  type: string;
  jurisdictionLevel: string;
  countryCode: string;
  stateCode?: string;
  lgaCode?: string;
  jurisdictionId?: string;
  parentAgencyId?: string;
  serviceCategories?: string[];
  capabilities?: string[];
  isGovernment?: boolean;
  isEmergencyResponder?: boolean;
  isDispatchable?: boolean;
  isFieldOperationsEnabled?: boolean;
  isDroneEnabled?: boolean;
  isBroadcastAuthority?: boolean;
  phone?: string;
  email?: string;
  contactMetadata?: Record<string, unknown>;
};

export type UpdateAgencyInput = {
  name?: string;
  shortName?: string | null;
  type?: string;
  jurisdictionLevel?: string;
  countryCode?: string;
  stateCode?: string | null;
  lgaCode?: string | null;
  jurisdictionId?: string | null;
  parentAgencyId?: string | null;
  serviceCategories?: string[];
  capabilities?: string[];
  isGovernment?: boolean;
  isEmergencyResponder?: boolean;
  isDispatchable?: boolean;
  isFieldOperationsEnabled?: boolean;
  isDroneEnabled?: boolean;
  isBroadcastAuthority?: boolean;
  phone?: string | null;
  email?: string | null;
  contactMetadata?: Record<string, unknown>;
  status?: string;
};

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

export async function listAgencies(query: ListAgenciesQuery = {}): Promise<AgencyView[]> {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: Record<string, unknown>[] }>("/agencies", {
      token,
      query,
    });
    return (response.data ?? []).map(toAgencyView);
  }, []);
}

export async function fetchAgency(id: string): Promise<AgencyView | null> {
  return withToken(async (token) => {
    try {
      const response = await apiRequest<{ data: Record<string, unknown> }>(`/agencies/${encodeURIComponent(id)}`, {
        token,
      });
      return toAgencyView(response.data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }, null);
}

export async function createAgency(input: CreateAgencyInput): Promise<AgencyView> {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  const response = await apiRequest<{ data: Record<string, unknown> }>("/admin/agencies", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
  return toAgencyView(response.data);
}

export async function updateAgency(id: string, input: UpdateAgencyInput): Promise<AgencyView> {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  const response = await apiRequest<{ data: Record<string, unknown> }>(
    `/admin/agencies/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(input),
    },
  );
  return toAgencyView(response.data);
}

export async function activateAgency(id: string): Promise<AgencyView> {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  const response = await apiRequest<{ data: Record<string, unknown> }>(
    `/admin/agencies/${encodeURIComponent(id)}/activate`,
    { method: "POST", token, body: JSON.stringify({}) },
  );
  return toAgencyView(response.data);
}

export async function deactivateAgency(id: string): Promise<AgencyView> {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  const response = await apiRequest<{ data: Record<string, unknown> }>(
    `/admin/agencies/${encodeURIComponent(id)}/deactivate`,
    { method: "POST", token, body: JSON.stringify({}) },
  );
  return toAgencyView(response.data);
}

export async function listAgencyUnits(agencyId: string): Promise<AgencyUnitView[]> {
  return withToken(async (token) => {
    const response = await apiRequest<{ data: Record<string, unknown>[] }>(
      `/agencies/${encodeURIComponent(agencyId)}/units`,
      { token },
    );
    return (response.data ?? []).map(toAgencyUnitView);
  }, []);
}
