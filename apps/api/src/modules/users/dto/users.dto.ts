import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

export class UpdateCitizenProfileDto {
  @ApiPropertyOptional({ example: "Ada" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional({ example: "Okeke" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

  @ApiPropertyOptional({ example: "1990-05-12" })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ example: "Female" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  gender?: string | null;

  @ApiPropertyOptional({ example: "12 Allen Avenue" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string | null;

  @ApiPropertyOptional({ example: "Nigeria" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({ example: "Lagos" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @ApiPropertyOptional({ example: "Ikeja" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lga?: string;

  @ApiPropertyOptional({ example: "+2348012345678" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;
}

export class UpsertEmergencyContactDto {
  @ApiProperty({ example: "Chinwe Okeke" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: "+2348099990000" })
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ example: "Spouse" })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  relationship!: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;
}

export class AvatarPresignDto {
  @ApiProperty({ example: "image/jpeg" })
  @IsString()
  @IsIn(["image/jpeg", "image/png", "image/webp"])
  contentType!: string;

  @ApiProperty({ example: "avatar.jpg" })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  fileName!: string;

  @ApiPropertyOptional({ example: 240000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  sizeBytes?: number;
}

export class AvatarConfirmDto {
  @ApiProperty({ example: "avatars/user-id/uuid.jpg" })
  @IsString()
  @MinLength(10)
  @MaxLength(240)
  objectKey!: string;

  @ApiProperty({ example: "the-eye" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  bucket!: string;

  @ApiProperty({ example: "image/jpeg" })
  @IsString()
  @IsIn(["image/jpeg", "image/png", "image/webp"])
  contentType!: string;
}

export class SubmitKycDto {
  @ApiProperty({ example: "NationalID" })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  documentType!: string;

  @ApiPropertyOptional({ example: "A12345678" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  documentNumber?: string;

  @ApiPropertyOptional({ description: "Private storage object key for the uploaded document" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  documentObjectKey?: string;
}

export class ReviewKycDto {
  @ApiProperty({ enum: ["approve", "reject"] })
  @IsString()
  @IsIn(["approve", "reject"])
  decision!: "approve" | "reject";

  @ApiPropertyOptional({ example: "Document image is illegible" })
  @ValidateIf((dto: ReviewKycDto) => dto.decision === "reject")
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}

export class RequestAccountDeletionDto {
  @ApiProperty({ description: "Must be true to acknowledge irreversible account deactivation request" })
  @IsBoolean()
  confirm!: boolean;
}
