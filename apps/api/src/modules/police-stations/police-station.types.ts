export const POLICE_VERIFICATION_STATUSES = [
  "VerifiedOfficial",
  "VerifiedByAdmin",
  "Unverified",
  "Closed",
  "Duplicate",
] as const;

export type PoliceVerificationStatus = (typeof POLICE_VERIFICATION_STATUSES)[number];

export const VERIFIED_POLICE_STATUSES: PoliceVerificationStatus[] = [
  "VerifiedOfficial",
  "VerifiedByAdmin",
];

export const POLICE_DATA_SOURCES = ["verifiedDatabase", "googlePlaces"] as const;
export type PoliceDataSource = (typeof POLICE_DATA_SOURCES)[number];

export type PoliceStationNearbyResult = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceMeters: number | null;
  phone: string | null;
  navigationUrl: string;
  dataSource: PoliceDataSource;
  verificationStatus: PoliceVerificationStatus | "GoogleMapsResult";
  googlePlaceId?: string;
  googleAttribution?: string;
  state?: string | null;
  lga?: string | null;
  stationType?: string | null;
};

export type GooglePlacesPoliceResult = {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  navigationUrl: string;
  businessStatus: string | null;
  attribution: string;
};
