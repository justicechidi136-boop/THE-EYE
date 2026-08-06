import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CommunityVerificationRespondDto {
  @ApiProperty({ enum: ["Confirmed", "NotFound", "StillOngoing", "AppearsResolved", "UnsafeToVerify", "Skipped", "Unsure"] })
  @IsString()
  responseType!: string;

  @ApiPropertyOptional({ enum: ["High", "Medium", "Low"] })
  @IsOptional()
  @IsString()
  confidence?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  voiceAttachmentId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(128)
  clientActionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationQuality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationSource?: string;
}

export class CommunityVerificationSkipDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  clientActionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class IssueCommunityVerificationDto {
  @ApiPropertyOptional()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  radiusMeters?: number;

  @ApiPropertyOptional()
  @IsOptional()
  ttlMinutes?: number;
}

export class ExtendCommunityVerificationDto {
  @ApiProperty()
  extendMinutes!: number;
}

export class RevokeCommunityVerificationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class FlagCommunityVerificationResponseDto {
  @ApiProperty()
  flagged!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AcceptCommunityRecommendationDto {
  @ApiProperty({ enum: ["accept", "reject"] })
  @IsEnum(["accept", "reject"] as const)
  decision!: "accept" | "reject";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
