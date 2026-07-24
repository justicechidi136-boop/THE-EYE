export type PoliceVerificationStatus =
  | "VerifiedOfficial"
  | "VerifiedByAdmin"
  | "Unverified"
  | "Closed"
  | "Duplicate";

export type PoliceStationFormValues = {
  name: string;
  stationType: string;
  country: string;
  state: string;
  lga: string;
  address: string;
  latitude: string;
  longitude: string;
  officialPhone: string;
  emergencyPhone: string;
  source: string;
  sourceReference: string;
  verificationStatus: PoliceVerificationStatus;
  isActive: boolean;
  duplicateOverrideReason: string;
};

export type PoliceStationDuplicate = {
  id: string;
  name: string;
  address: string;
  verificationStatus: string;
  matchReasons: string[];
};

export const defaultPoliceStationFormValues: PoliceStationFormValues = {
  name: "",
  stationType: "police",
  country: "Nigeria",
  state: "",
  lga: "",
  address: "",
  latitude: "",
  longitude: "",
  officialPhone: "",
  emergencyPhone: "",
  source: "",
  sourceReference: "",
  verificationStatus: "Unverified",
  isActive: true,
  duplicateOverrideReason: "",
};

export type PoliceStationVerifyPayload = {
  verificationStatus: PoliceVerificationStatus;
  source: string;
  sourceReference: string;
  verificationNotes: string;
  duplicateOverrideReason?: string;
};
