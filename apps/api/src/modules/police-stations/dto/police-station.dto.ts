import { BadRequestException } from "@nestjs/common";

export type PoliceStationSearchQuery = {
  state?: string;
  lga?: string;
  q?: string;
  search?: string;
  agencyType?: string;
  cursor?: string;
  limit?: string;
};

export type PoliceStationListQuery = PoliceStationSearchQuery & {
  latitude?: string;
  longitude?: string;
  radius?: string;
};

export type NearbyPoliceStationsQuery = {
  latitude?: string;
  longitude?: string;
  radius?: string;
  radiusMeters?: string;
  state?: string;
  lga?: string;
  search?: string;
  cursor?: string;
  limit?: string;
};

export type NearestPoliceStationsQuery = {
  latitude?: string;
  longitude?: string;
  limit?: string;
  radiusMeters?: string;
  agencyType?: string;
};

export type UpsertPoliceStationDto = {
  agencyId?: string;
  jurisdictionId: string;
  name: string;
  phone?: string;
  address: string;
  agencyType: string;
  latitude: number;
  longitude: number;
  source?: string;
  sourceReference?: string;
  verificationStatus?: string;
  officialPhone?: string;
  emergencyPhone?: string;
  googlePlaceId?: string;
};

export type VerifyPoliceStationDto = {
  officialName: string;
  address: string;
  latitude: number;
  longitude: number;
  verificationStatus: "VerifiedOfficial" | "VerifiedByAdmin" | "Unverified" | "Closed" | "Duplicate";
  source: string;
  sourceReference: string;
  officialPhone?: string;
  emergencyPhone?: string;
  googlePlaceId?: string;
  verificationNotes?: string;
};

export function parseNearestQuery(query: NearestPoliceStationsQuery) {
  const latitude = Number(query.latitude);
  const longitude = Number(query.longitude);
  if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) throw new BadRequestException("latitude must be between -90 and 90");
  if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) throw new BadRequestException("longitude must be between -180 and 180");
  const limit = query.limit ? Math.min(Math.max(Number(query.limit), 1), 50) : 10;
  const radiusMeters = query.radiusMeters ? Math.min(Math.max(Number(query.radiusMeters), 100), 100000) : 25000;
  return { latitude, longitude, limit, radiusMeters, agencyType: query.agencyType };
}

export function parseNearbyPoliceQuery(query: NearbyPoliceStationsQuery) {
  const latitude = Number(query.latitude);
  const longitude = Number(query.longitude);
  if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) throw new BadRequestException("latitude must be between -90 and 90");
  if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) throw new BadRequestException("longitude must be between -180 and 180");
  const defaultRadius = Number(process.env.GOOGLE_PLACES_DEFAULT_RADIUS_METERS ?? 25000);
  const maxRadius = Number(process.env.GOOGLE_PLACES_MAX_RADIUS_METERS ?? 50000);
  const requestedRadius = query.radiusMeters ?? query.radius;
  const radiusMeters = requestedRadius
    ? Math.min(Math.max(Number(requestedRadius), 500), maxRadius)
    : Math.min(defaultRadius, maxRadius);
  const limit = query.limit ? Math.min(Math.max(Number(query.limit), 1), 25) : 10;
  const offset = decodePoliceCursor(query.cursor);
  return {
    latitude,
    longitude,
    radiusMeters,
    limit,
    offset,
    state: query.state?.trim() || undefined,
    lga: query.lga?.trim() || undefined,
    search: query.search?.trim() || undefined,
  };
}

function decodePoliceCursor(cursor?: string) {
  if (!cursor?.trim()) return 0;
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = Number(decoded);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10_000) {
      throw new BadRequestException("cursor is invalid");
    }
    return parsed;
  } catch {
    throw new BadRequestException("cursor is invalid");
  }
}

export function encodePoliceCursor(offset: number) {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

export function validatePoliceStationDto(dto: UpsertPoliceStationDto) {
  if (!dto.jurisdictionId) throw new BadRequestException("jurisdictionId is required");
  if (!dto.name || dto.name.trim().length < 2) throw new BadRequestException("Station name is required");
  if (!dto.address || dto.address.trim().length < 5) throw new BadRequestException("Address is required");
  if (!dto.agencyType || dto.agencyType.trim().length < 2) throw new BadRequestException("agencyType is required");
  if (typeof dto.latitude !== "number" || dto.latitude < -90 || dto.latitude > 90) throw new BadRequestException("latitude must be between -90 and 90");
  if (typeof dto.longitude !== "number" || dto.longitude < -180 || dto.longitude > 180) throw new BadRequestException("longitude must be between -180 and 180");
  if (dto.verificationStatus && !["VerifiedOfficial", "VerifiedByAdmin", "Unverified", "Closed", "Duplicate"].includes(dto.verificationStatus)) {
    throw new BadRequestException("verificationStatus is invalid");
  }
  if (dto.verificationStatus && dto.verificationStatus !== "Unverified" && (!dto.source || !dto.sourceReference)) {
    throw new BadRequestException("source and sourceReference are required for verified police records");
  }
}

export function validateVerifyPoliceStationDto(dto: VerifyPoliceStationDto) {
  if (!dto.officialName?.trim()) throw new BadRequestException("officialName is required");
  if (!dto.address?.trim()) throw new BadRequestException("address is required");
  if (!dto.source?.trim()) throw new BadRequestException("source is required");
  if (!dto.sourceReference?.trim()) throw new BadRequestException("sourceReference is required");
  validatePoliceStationDto({
    jurisdictionId: "00000000-0000-0000-0000-000000000001",
    name: dto.officialName,
    address: dto.address,
    agencyType: "police",
    latitude: dto.latitude,
    longitude: dto.longitude,
  });
}
