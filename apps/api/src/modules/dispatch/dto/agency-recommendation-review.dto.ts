import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export const AGENCY_RECOMMENDATION_REVIEW_OUTCOMES = [
  "ACCEPTED_AS_RELEVANT",
  "NOT_RELEVANT",
  "INSUFFICIENT_OPERATIONAL_DATA",
  "WRONG_JURISDICTION",
  "WRONG_CAPABILITY",
  "OUTDATED_DIRECTORY_DATA",
  "OTHER",
] as const;

export class CreateAgencyRecommendationReviewDto {
  @IsUUID()
  agencyId!: string;

  @IsOptional()
  @IsUUID()
  endpointId?: string;

  @IsIn(["AGENCY_OFFICE", "POLICE_STATION", "STRUCTURAL_AGENCY"])
  endpointType!: string;

  @IsIn(AGENCY_RECOMMENDATION_REVIEW_OUTCOMES)
  outcome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AgencyRecommendationQualityReportQueryDto {
  @IsOptional() @IsString() @MaxLength(80) ruleVersion?: string;
  @IsOptional() @IsUUID() stateId?: string;
  @IsOptional() @IsString() @MaxLength(80) incidentType?: string;
  @IsOptional() @IsUUID() agencyId?: string;
  @IsOptional() @IsIn(["PRIMARY", "SECONDARY", "STRUCTURAL_ONLY", "INFORMATIONAL"]) tier?: string;
  @IsOptional() @IsIn(AGENCY_RECOMMENDATION_REVIEW_OUTCOMES) outcome?: string;
  @IsOptional() @IsDateString() reviewedFrom?: string;
  @IsOptional() @IsDateString() reviewedTo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit = 100;
}
