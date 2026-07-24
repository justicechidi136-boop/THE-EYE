import type { PoliceStationFormValues } from "./types";

export type PoliceFormValidationResult = {
  errors: Partial<Record<keyof PoliceStationFormValues, string>>;
  latitude?: number;
  longitude?: number;
};

export function parseCoordinatePair(input: string): { latitude?: number; longitude?: number; error?: string } {
  const parts = input.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) return { error: "Paste coordinates as latitude, longitude" };
  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return { error: "Latitude must be between -90 and 90" };
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return { error: "Longitude must be between -180 and 180" };
  return { latitude, longitude };
}

export function googleMapsPreviewUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

export function validatePoliceStationForm(values: PoliceStationFormValues): PoliceFormValidationResult {
  const errors: Partial<Record<keyof PoliceStationFormValues, string>> = {};
  if (!values.name.trim() || values.name.trim().length < 2) errors.name = "Official name is required";
  if (!values.stationType.trim()) errors.stationType = "Station type is required";
  if (!values.country.trim()) errors.country = "Country is required";
  if (!values.state.trim()) errors.state = "State is required";
  if (!values.lga.trim()) errors.lga = "LGA is required";
  if (!values.address.trim() || values.address.trim().length < 5) errors.address = "Address is required";
  if (!values.source.trim()) errors.source = "Source is required";
  if (!values.sourceReference.trim()) errors.sourceReference = "Source reference is required";
  if (/<script|javascript:|data:/i.test(values.sourceReference)) errors.sourceReference = "Source reference contains unsafe content";

  const latitude = Number(values.latitude);
  const longitude = Number(values.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.latitude = "Valid latitude is required";
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.longitude = "Valid longitude is required";

  if (values.verificationStatus === "VerifiedOfficial" && /google places|google maps|places api/i.test(values.source)) {
    errors.source = "Google-only sources cannot be used for Verified Official status";
  }

  return {
    errors,
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
  };
}

export function buildPoliceStationPayload(values: PoliceStationFormValues) {
  const validation = validatePoliceStationForm(values);
  if (Object.keys(validation.errors).length || validation.latitude == null || validation.longitude == null) {
    throw new Error(Object.values(validation.errors)[0] ?? "Validation failed");
  }
  return {
    name: values.name.trim(),
    agencyType: values.stationType.trim(),
    stationType: values.stationType.trim(),
    country: values.country.trim(),
    state: values.state.trim(),
    lga: values.lga.trim(),
    address: values.address.trim(),
    latitude: validation.latitude,
    longitude: validation.longitude,
    officialPhone: values.officialPhone.trim() || undefined,
    emergencyPhone: values.emergencyPhone.trim() || undefined,
    source: values.source.trim(),
    sourceReference: values.sourceReference.trim(),
    verificationStatus: values.verificationStatus,
    isActive: values.isActive,
    duplicateOverrideReason: values.duplicateOverrideReason.trim() || undefined,
  };
}
