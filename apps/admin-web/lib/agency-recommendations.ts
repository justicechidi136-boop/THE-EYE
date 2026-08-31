export type RecommendationTier = "PRIMARY" | "SECONDARY" | "STRUCTURAL_ONLY" | "INFORMATIONAL";

export const recommendationReviewOutcomes = [
  "ACCEPTED_AS_RELEVANT",
  "NOT_RELEVANT",
  "INSUFFICIENT_OPERATIONAL_DATA",
  "WRONG_JURISDICTION",
  "WRONG_CAPABILITY",
  "OUTDATED_DIRECTORY_DATA",
  "OTHER",
] as const;

export type RecommendationReviewOutcome = typeof recommendationReviewOutcomes[number];

export type AgencyRecommendationReview = {
  id: string;
  outcome: RecommendationReviewOutcome;
  note: string | null;
  reviewerAdminId: string;
  reviewedAt: string;
  recommendationRuleVersion: string;
  previousReviewId: string | null;
};

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
  review?: AgencyRecommendationReview | null;
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

export function recommendationReviewLabel(outcome: RecommendationReviewOutcome) {
  const labels: Record<RecommendationReviewOutcome, string> = {
    ACCEPTED_AS_RELEVANT: "Relevant",
    NOT_RELEVANT: "Not relevant",
    INSUFFICIENT_OPERATIONAL_DATA: "Insufficient operational data",
    WRONG_JURISDICTION: "Wrong jurisdiction",
    WRONG_CAPABILITY: "Wrong capability",
    OUTDATED_DIRECTORY_DATA: "Outdated directory data",
    OTHER: "Other",
  };
  return labels[outcome];
}

export type AgencyRecommendationQualityReport = {
  summary: Record<RecommendationReviewOutcome, number> & {
    totalReviewed: number;
    acceptanceRate: number | null;
    acceptanceRateDefinition: string;
  };
  reviews: Array<AgencyRecommendationReview & {
    agencyId: string;
    agencyName: string;
    endpointId: string | null;
    endpointType: string;
    endpointName: string | null;
    recommendationTier: RecommendationTier;
    matchedCapability: string;
    stateName: string;
    incidentType: string;
  }>;
  dataQualityFindings: Array<{
    reviewId: string;
    agencyName: string;
    stateName: string;
    findingType: string;
    note: string | null;
    reviewedAt: string;
    humanReviewRequired: boolean;
    automaticDirectoryChange: boolean;
  }>;
  filters: {
    states: Array<{ id: string; name: string }>;
    agencies: Array<{ id: string; name: string }>;
  };
  meta: {
    automaticDirectoryChanges: number;
    automaticRoutingChanges: number;
    externalCommunicationCalls: number;
    incidentStateMutations: number;
  };
};
