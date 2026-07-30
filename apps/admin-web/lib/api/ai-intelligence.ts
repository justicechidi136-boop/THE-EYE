import { ApiError, apiRequest } from "./client";
import { getAccessToken } from "../session";

export type AiIntelligenceDashboard = {
  communityRiskScore: number;
  crimeHotspotCount: number;
  falseReportRate: number;
  volunteerCoverage: number;
  avgCommunityConfidence: number;
  hotspots: Array<{
    id: string;
    title: string;
    location: string;
    confidenceScore: number;
    latitude: number;
    longitude: number;
    createdAt: string;
  }>;
  verificationInsights: Array<{
    id: string;
    title: string;
    confidence: number;
    verificationStatus: string;
    communityId: string;
    communityName: string;
  }>;
  communitiesTracked: number;
  windowDays: number;
  generatedAt: string;
};

export async function fetchAiIntelligenceDashboard(query?: { windowDays?: number; communityId?: string }) {
  const token = await getAccessToken();
  if (!token) {
    return {
      communityRiskScore: 0,
      crimeHotspotCount: 0,
      falseReportRate: 0,
      volunteerCoverage: 0,
      avgCommunityConfidence: 0,
      hotspots: [],
      verificationInsights: [],
      communitiesTracked: 0,
      windowDays: query?.windowDays ?? 30,
      generatedAt: new Date().toISOString(),
    } satisfies AiIntelligenceDashboard;
  }
  try {
    const response = await apiRequest<{ data: AiIntelligenceDashboard }>("/neighborhood-watch/admin/ai-intelligence", {
      token,
      query: {
        windowDays: query?.windowDays ? String(query.windowDays) : undefined,
        communityId: query?.communityId,
      },
    });
    return response.data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return {
        communityRiskScore: 0,
        crimeHotspotCount: 0,
        falseReportRate: 0,
        volunteerCoverage: 0,
        avgCommunityConfidence: 0,
        hotspots: [],
        verificationInsights: [],
        communitiesTracked: 0,
        windowDays: query?.windowDays ?? 30,
        generatedAt: new Date().toISOString(),
      };
    }
    throw error;
  }
}
