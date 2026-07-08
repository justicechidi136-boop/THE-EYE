export type VerifyIncidentDto = {
  gpsAccuracyMeters?: number;
  observedAt?: string;
  locationConsistencyMeters?: number;
};

export type WitnessConfirmationDto = {
  confirms: boolean;
  note?: string;
  latitude?: number;
  longitude?: number;
  trustedReporter?: boolean;
};

export type CrowdRequestDto = {
  radiusMeters?: number;
  limit?: number;
};
