import { BadRequestException } from "@nestjs/common";
import type { CursorPageQuery } from "../../../common/pagination/cursor-pagination";
import type { ReportIncidentDto } from "./report-incident.dto";

export type ListCaseQuery = CursorPageQuery & {
  status?: string;
  reportStatus?: string;
  priority?: string;
  q?: string;
};

export type UpdateMissingPersonCaseDto = {
  fullName?: string;
  age?: number;
  gender?: string;
  description?: string;
  lastSeenAt?: string;
  lastSeenAddress?: string;
  latitude?: number;
  longitude?: number;
  reportStatus?: string;
};

export type UpdateStolenVehicleCaseDto = {
  plateNumber?: string;
  vin?: string;
  make?: string;
  model?: string;
  color?: string;
  year?: number;
  lastSeenAt?: string;
  lastSeenArea?: string;
  latitude?: number;
  longitude?: number;
  reportStatus?: string;
};

export type AdminCreateMissingPersonDto = Pick<ReportIncidentDto, "description" | "latitude" | "longitude" | "manualLatitude" | "manualLongitude" | "manualAddress" | "address" | "title" | "priority" | "occurredAt"> & {
  missingPerson: NonNullable<ReportIncidentDto["missingPerson"]>;
};

export type AdminCreateStolenVehicleDto = Pick<ReportIncidentDto, "description" | "latitude" | "longitude" | "manualLatitude" | "manualLongitude" | "manualAddress" | "address" | "title" | "priority" | "occurredAt"> & {
  stolenVehicle: NonNullable<ReportIncidentDto["stolenVehicle"]>;
};

export function validateUpdateMissingPersonCase(dto: UpdateMissingPersonCaseDto) {
  if (dto.fullName !== undefined && dto.fullName.trim().length < 2) {
    throw new BadRequestException("fullName must be at least 2 characters");
  }
  if (dto.latitude !== undefined && (dto.latitude < -90 || dto.latitude > 90)) {
    throw new BadRequestException("latitude must be between -90 and 90");
  }
  if (dto.longitude !== undefined && (dto.longitude < -180 || dto.longitude > 180)) {
    throw new BadRequestException("longitude must be between -180 and 180");
  }
}

export function validateUpdateStolenVehicleCase(dto: UpdateStolenVehicleCaseDto) {
  if (dto.plateNumber !== undefined && !dto.plateNumber.trim()) {
    throw new BadRequestException("plateNumber is required");
  }
  if (dto.latitude !== undefined && (dto.latitude < -90 || dto.latitude > 90)) {
    throw new BadRequestException("latitude must be between -90 and 90");
  }
  if (dto.longitude !== undefined && (dto.longitude < -180 || dto.longitude > 180)) {
    throw new BadRequestException("longitude must be between -180 and 180");
  }
}
