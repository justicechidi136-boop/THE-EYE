import { ApiError, apiRequest } from "./client";
import { getAccessToken } from "../session";

export type PolicySection =
  | "community"
  | "permissions"
  | "notifications"
  | "broadcasts"
  | "verification"
  | "patrols"
  | "volunteers"
  | "smartwatch"
  | "integrations";

export type ResolvedPolicy = {
  section: PolicySection;
  scopeKey: string;
  version: number;
  config: Record<string, unknown>;
  source: "community" | "jurisdiction" | "platform" | "default";
  updatedAt: string | null;
};

export async function fetchPolicies(communityId?: string): Promise<ResolvedPolicy[]> {
  const token = await getAccessToken();
  if (!token) return [];
  try {
    const response = await apiRequest<{ data: Array<{ section: PolicySection; policy: ResolvedPolicy }> }>("/admin/policies", {
      token,
      query: { communityId },
    });
    return response.data.map((entry) => entry.policy);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return [];
    throw error;
  }
}

export async function fetchPolicySection(section: PolicySection, communityId?: string): Promise<ResolvedPolicy | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const response = await apiRequest<{ data: ResolvedPolicy }>(`/admin/policies/${section}`, {
      token,
      query: { communityId },
    });
    return response.data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
}

export async function updatePolicySection(
  section: PolicySection,
  config: Record<string, unknown>,
  options?: { scope?: "platform" | "jurisdiction" | "community"; communityId?: string; changeReason?: string },
) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");
  return apiRequest<{ data: ResolvedPolicy }>(`/admin/policies/${section}`, {
    method: "PUT",
    token,
    body: JSON.stringify({
      scope: options?.scope ?? "jurisdiction",
      communityId: options?.communityId,
      config,
      changeReason: options?.changeReason,
    }),
  });
}

export async function fetchAdminPreferences() {
  const token = await getAccessToken();
  if (!token) return { theme: "system", notificationPrefs: {} };
  try {
    const response = await apiRequest<{ data: { theme: string; notificationPrefs: Record<string, unknown> } }>("/admin/preferences", { token });
    return response.data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return { theme: "system", notificationPrefs: {} };
    }
    throw error;
  }
}
