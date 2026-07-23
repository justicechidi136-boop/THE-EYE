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

export function validatePoliceStationDto(dto: UpsertPoliceStationDto) {
  if (!dto.jurisdictionId) throw new BadRequestException("jurisdictionId is required");
  if (!dto.name || dto.name.trim().length < 2) throw new BadRequestException("Station name is required");
  if (!dto.address || dto.address.trim().length < 5) throw new BadRequestException("Address is required");
  if (!dto.agencyType || dto.agencyType.trim().length < 2) throw new BadRequestException("agencyType is required");
  if (typeof dto.latitude !== "number" || dto.latitude < -90 || dto.latitude > 90) throw new BadRequestException("latitude must be between -90 and 90");
  if (typeof dto.longitude !== "number" || dto.longitude < -180 || dto.longitude > 180) throw new BadRequestException("longitude must be between -180 and 180");
}
