import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  MinLength,
} from "class-validator";
import {
  AGENCY_CAPABILITIES,
  AGENCY_JURISDICTION_LEVELS,
  AGENCY_TYPES,
  AGENCY_UNIT_KINDS,
  AgencyStatus,
} from "@the-eye/shared";

export class ListAgenciesQueryDto {
  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  stateCode?: string;

  @IsOptional()
  @IsString()
  lgaCode?: string;

  @IsOptional()
  @IsString()
  agencyType?: string;

  @IsOptional()
  @IsString()
  capability?: string;

  @IsOptional()
  @IsString()
  isDispatchable?: string;

  @IsOptional()
  @IsString()
  isFieldOperationsEnabled?: string;

  @IsOptional()
  @IsString()
  isActive?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateAgencyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  officialName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsIn(["FEDERAL", "STATE", "LOCAL", "MULTI_LEVEL"])
  governmentLevel?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ["https"] })
  officialWebsite?: string;

  @IsOptional()
  @IsIn(["VERIFIED", "PARTIALLY_VERIFIED", "PENDING_VERIFICATION", "DISPUTED", "RETIRED"])
  verificationStatus?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ["https"] })
  verificationSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  dataQualityNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  shortName?: string;

  @IsIn(AGENCY_TYPES)
  type!: string;

  @IsIn(AGENCY_JURISDICTION_LEVELS)
  jurisdictionLevel!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(8)
  countryCode!: string;

  @IsOptional()
  @IsString()
  stateCode?: string;

  @IsOptional()
  @IsString()
  lgaCode?: string;

  @IsOptional()
  @IsUUID()
  jurisdictionId?: string;

  @IsOptional()
  @IsUUID()
  parentAgencyId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceCategories?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(AGENCY_CAPABILITIES, { each: true })
  capabilities?: string[];

  @IsOptional()
  @IsBoolean()
  isGovernment?: boolean;

  @IsOptional()
  @IsBoolean()
  isEmergencyResponder?: boolean;

  @IsOptional()
  @IsBoolean()
  isDispatchable?: boolean;

  @IsOptional()
  @IsBoolean()
  isFieldOperationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isDroneEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isBroadcastAuthority?: boolean;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsObject()
  contactMetadata?: Record<string, unknown>;
}

export class UpdateAgencyDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  officialName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsIn(["FEDERAL", "STATE", "LOCAL", "MULTI_LEVEL"])
  governmentLevel?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ["https"] })
  officialWebsite?: string | null;

  @IsOptional()
  @IsIn(["VERIFIED", "PARTIALLY_VERIFIED", "PENDING_VERIFICATION", "DISPUTED", "RETIRED"])
  verificationStatus?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ["https"] })
  verificationSource?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  dataQualityNotes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  shortName?: string;

  @IsOptional()
  @IsIn(AGENCY_TYPES)
  type?: string;

  @IsOptional()
  @IsIn(AGENCY_JURISDICTION_LEVELS)
  jurisdictionLevel?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  stateCode?: string | null;

  @IsOptional()
  @IsString()
  lgaCode?: string | null;

  @IsOptional()
  @IsUUID()
  jurisdictionId?: string | null;

  @IsOptional()
  @IsUUID()
  parentAgencyId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceCategories?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(AGENCY_CAPABILITIES, { each: true })
  capabilities?: string[];

  @IsOptional()
  @IsBoolean()
  isGovernment?: boolean;

  @IsOptional()
  @IsBoolean()
  isEmergencyResponder?: boolean;

  @IsOptional()
  @IsBoolean()
  isDispatchable?: boolean;

  @IsOptional()
  @IsBoolean()
  isFieldOperationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isDroneEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isBroadcastAuthority?: boolean;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
  @IsObject()
  contactMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsIn([AgencyStatus.Active, AgencyStatus.Inactive])
  status?: string;
}

export class CreateAgencyUnitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  unitIdentifier!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsIn(AGENCY_UNIT_KINDS)
  unitKind?: string;

  @IsOptional()
  @IsUUID()
  parentUnitId?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  stateCode?: string;

  @IsOptional()
  @IsString()
  lgaCode?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];
}

export class UpdateAgencyUnitDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsIn(AGENCY_UNIT_KINDS)
  unitKind?: string;

  @IsOptional()
  @IsUUID()
  parentUnitId?: string | null;

  @IsOptional()
  @IsString()
  countryCode?: string | null;

  @IsOptional()
  @IsString()
  stateCode?: string | null;

  @IsOptional()
  @IsString()
  lgaCode?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
