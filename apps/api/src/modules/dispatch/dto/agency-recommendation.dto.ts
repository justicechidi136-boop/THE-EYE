import { Type } from "class-transformer";
import { IsIn, IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from "class-validator";

const incidentTypes = [
  "Emergency", "Crime", "Accident", "Fire", "Medical", "CommunitySafety",
  "Kidnapping", "Abuse", "SuspiciousActivity", "MissingPerson", "StolenVehicle", "SOS",
] as const;

const incidentPriorities = [
  "P1LifeThreatening", "P2ActiveCrimeAccident", "P3SuspiciousActivity", "P4GeneralSafety",
] as const;

export class AgencyRecommendationPreviewDto {
  @IsIn(incidentTypes)
  incidentType!: string;

  @IsUUID()
  countryId!: string;

  @IsOptional() @IsUUID() stateId?: string;
  @IsOptional() @IsUUID() lgaId?: string;
  @IsOptional() @IsUUID() wardId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @IsIn(incidentPriorities) priority?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}
