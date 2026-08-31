import { Type } from "class-transformer";
import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export class AgencyDirectoryQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() incidentType?: string;
  @IsOptional() @IsUUID() stateId?: string;
  @IsOptional() @IsUUID() lgaId?: string;
  @IsOptional() @IsUUID() wardId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}

export class NearbyAgencyQueryDto {
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) lat!: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) lng!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(100) @Max(200000) radiusMeters = 25000;
  @IsOptional() @IsString() type?: string;
}
