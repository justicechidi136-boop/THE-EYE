export type RecommendationTier = "PRIMARY" | "SECONDARY" | "STRUCTURAL_ONLY" | "INFORMATIONAL";

export type AgencyRecommendation = {
  agencyId: string;
  agencyName: string;
  officeId: string | null;
  officeName: string | null;
  endpointType: "AGENCY_OFFICE" | "POLICE_STATION" | "STRUCTURAL_AGENCY";
  tier: RecommendationTier;
  capability: string;
  jurisdictionLevel: string;
  verificationStatus: string;
  operationalReady: boolean;
  coordinateQualified: boolean;
  coordinates: { latitude: number; longitude: number } | null;
  distanceMeters: number | null;
  publicAddress: string | null;
  publicContacts: Array<{ type: string; value: string; label: string | null; emergencyOnly: boolean }>;
  reasons: string[];
  limitations: string[];
};

export type AgencyRecommendationResponse = {
  ruleVersion: string;
  advisoryOnly: boolean;
  actionableRecommendations: AgencyRecommendation[];
  structuralMatches: AgencyRecommendation[];
  informationalMatches: AgencyRecommendation[];
  limitations: string[];
  input: {
    geography: {
      countryName: string;
      stateName: string | null;
      lgaName: string | null;
      wardName: string | null;
    };
  };
  meta: { incidentStateChanged: boolean; outboundCommunicationCalls: number };
};

export function formatRecommendationDistance(distanceMeters: number | null) {
  if (distanceMeters == null) return "Distance unavailable";
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m`;
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

export function recommendationGroupLabel(tier: RecommendationTier) {
  if (tier === "PRIMARY") return "Primary operational responders";
  if (tier === "SECONDARY") return "Supporting operational responders";
  if (tier === "STRUCTURAL_ONLY") return "Structural / directory matches";
  return "Informational directory matches";
}

export function recommendationNavigationUrl(recommendation: AgencyRecommendation) {
  if (!recommendation.coordinateQualified || !recommendation.coordinates) return null;
  const { latitude, longitude } = recommendation.coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
