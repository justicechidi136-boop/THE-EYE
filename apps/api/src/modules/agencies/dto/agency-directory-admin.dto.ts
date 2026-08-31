import { IncidentType } from "@the-eye/shared";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

const officeTypes = [
  "HEADQUARTERS", "COMMAND", "FORMATION", "DIVISION", "STATION", "ZONAL_OFFICE",
  "STATE_OFFICE", "LOCAL_OFFICE", "OTHER",
] as const;
const coverageTypes = ["NATIONAL", "STATE", "LGA", "WARD", "CUSTOM_COVERAGE_AREA"] as const;
const contactTypes = [
  "PHONE", "EMERGENCY_PHONE", "TOLL_FREE", "SMS", "WHATSAPP", "EMAIL", "WEBSITE",
  "REPORTING_PORTAL", "SOCIAL_MEDIA_OFFICIAL",
] as const;
const verificationStates = [
  "VERIFIED", "PARTIALLY_VERIFIED", "PENDING_VERIFICATION", "DISPUTED", "RETIRED",
] as const;

class CanonicalGeographyDto {
  @IsUUID()
  countryId!: string;

  @IsOptional()
  @IsUUID()
  stateId?: string;

  @IsOptional()
  @IsUUID()
  lgaId?: string;

  @IsOptional()
  @IsUUID()
  wardId?: string;
}

export class CreateAgencyOfficeDto extends CanonicalGeographyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsIn(officeTypes)
  officeType!: string;

  @IsOptional()
  @IsUUID()
  parentOfficeId?: string;

  @IsOptional()
  @IsUUID()
  policeStationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  physicalAddress?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  coordinatesVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  is24Hours?: boolean;

  @IsIn(verificationStates)
  verificationStatus!: string;

  @ValidateIf((value) => value.verificationStatus !== "PENDING_VERIFICATION")
  @IsUrl({ require_protocol: true, protocols: ["https"] })
  sourceUrl?: string;
}

export class UpdateAgencyOfficeDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) name?: string;
  @IsOptional() @IsIn(officeTypes) officeType?: string;
  @IsOptional() @IsString() @MaxLength(500) physicalAddress?: string | null;
  @IsOptional() @IsLatitude() latitude?: number | null;
  @IsOptional() @IsLongitude() longitude?: number | null;
  @IsOptional() @IsBoolean() coordinatesVerified?: boolean;
  @IsOptional() @IsBoolean() is24Hours?: boolean | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsIn(verificationStates) verificationStatus?: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ["https"] }) sourceUrl?: string | null;
}

export class CreateAgencyContactDto {
  @IsOptional() @IsUUID() officeId?: string;
  @IsIn(contactTypes) type!: string;
  @IsString() @MinLength(2) @MaxLength(500) value!: string;
  @IsOptional() @IsString() @MaxLength(120) label?: string;
  @IsOptional() @IsBoolean() emergencyOnly?: boolean;
  @IsBoolean() publiclyVerified!: boolean;
  @IsIn(verificationStates) verificationStatus!: string;
  @ValidateIf((value) => value.publiclyVerified)
  @IsUrl({ require_protocol: true, protocols: ["https"] })
  sourceUrl?: string;
}

export class UpdateAgencyContactDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(500) value?: string;
  @IsOptional() @IsString() @MaxLength(120) label?: string | null;
  @IsOptional() @IsBoolean() emergencyOnly?: boolean;
  @IsOptional() @IsBoolean() publiclyVerified?: boolean;
  @IsOptional() @IsIn(verificationStates) verificationStatus?: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ["https"] }) sourceUrl?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateAgencyJurisdictionDto extends CanonicalGeographyDto {
  @IsOptional() @IsUUID() officeId?: string;
  @IsIn(coverageTypes) coverageType!: string;
  @IsOptional() @IsObject() customCoverage?: Record<string, unknown>;
  @IsOptional() @IsInt() @Min(0) @Max(10000) priority?: number;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class UpdateAgencyJurisdictionDto {
  @IsOptional() @IsInt() @Min(0) @Max(10000) priority?: number;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsObject() customCoverage?: Record<string, unknown> | null;
}

export class UpsertAgencyIncidentCapabilityDto {
  @IsIn(Object.values(IncidentType))
  incidentType!: IncidentType;

  @IsOptional() @IsInt() @Min(0) @Max(10000) priority?: number;
  @IsOptional() @IsBoolean() canReceiveReport?: boolean;
  @IsOptional() @IsBoolean() canDispatch?: boolean;
  @IsOptional() @IsBoolean() canEscalate?: boolean;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class AgencyVerificationFreshnessQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650) staleDays?: number;
  @IsOptional() @IsIn(verificationStates) verificationStatus?: string;
  @IsOptional() @IsString() @MaxLength(500) source?: string;
  @IsOptional() @IsUUID() agencyId?: string;
  @IsOptional() @IsUUID() stateId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
}

export class AgencyCoverageReportQueryDto {
  @IsOptional() @IsUUID() stateId?: string;
}
