import {
  ArrayUnique,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class PreProvisionFieldDeviceDto {
  @IsString()
  @MaxLength(120)
  deviceName!: string;

  @IsOptional() @IsString() @MaxLength(64) operationalRole?: string;
  @IsOptional() @IsUUID() permissionProfileId?: string;
  @IsOptional() @IsString() @MaxLength(120) assignedTeamId?: string;
  @IsOptional() @IsUUID() assignedUserId?: string;
  @IsOptional() @IsUUID() assignedUnitId?: string;
  @IsOptional() @IsUUID() agencyId?: string;
  @IsOptional() @IsString() @MaxLength(8) countryCode?: string;
  @IsOptional() @IsString() @MaxLength(16) stateCode?: string;
  @IsOptional() @IsString() @MaxLength(32) lgaCode?: string;
  @IsOptional() @IsString() @MaxLength(32) deviceMode?: string;
  @IsOptional() @IsString() @MaxLength(64) activationPolicy?: string;
  @IsOptional() @IsISO8601() activationExpiresAt?: string;
  @IsOptional() @IsISO8601() reviewAt?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsString() @MaxLength(120) inventoryAssetRef?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) permissionOverrides?: string[];
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) permissionDenies?: string[];
}

export class UpdateFieldDeviceProvisioningDto {
  @IsOptional() @IsString() @MaxLength(64) operationalRole?: string;
  @IsOptional() @IsUUID() permissionProfileId?: string | null;
  @IsOptional() @IsString() @MaxLength(120) assignedTeamId?: string | null;
  @IsOptional() @IsString() @MaxLength(32) deviceMode?: string | null;
  @IsOptional() @IsString() @MaxLength(64) activationPolicy?: string;
  @IsOptional() @IsISO8601() activationExpiresAt?: string | null;
  @IsOptional() @IsISO8601() reviewAt?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string | null;
  @IsOptional() @IsString() @MaxLength(120) inventoryAssetRef?: string | null;
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) permissionOverrides?: string[];
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) permissionDenies?: string[];
}
