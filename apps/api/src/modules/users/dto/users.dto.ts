import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

export class CreateOperationalAdminDto {
  @ApiProperty({ enum: ["field_officer", "lga_admin"] })
  @IsString()
  @IsIn(["field_officer", "lga_admin"])
  accountType!: "field_officer" | "lga_admin";

  @ApiProperty({ example: "Officer Ada Okeke" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @ApiProperty({ example: "ada.okeke@agency.gov.ng" })
  @IsEmail()
  @MaxLength(240)
  email!: string;

  @ApiProperty({ minLength: 12, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ description: "Required for field officer accounts" })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: "Required for LGA Admin accounts" })
  @IsOptional()
  @IsUUID()
  jurisdictionId?: string;
}

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

  @ApiPropertyOptional({ example: "NG" })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string | null;

  @ApiPropertyOptional({ example: "ha" })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  preferredLocale?: string | null;

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

export const EMERGENCY_CONTACT_RELATIONSHIPS = [
  "Parent",
  "Spouse",
  "Sibling",
  "Child",
  "Guardian",
  "Relative",
  "Friend",
  "Neighbour",
  "Colleague",
  "Other",
] as const;

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
  @IsIn(EMERGENCY_CONTACT_RELATIONSHIPS)
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

export class CreateCitizenVehicleDto {
  @ApiProperty({ example: "Toyota" })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  make!: string;

  @ApiProperty({ example: "Corolla" })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  model!: string;

  @ApiProperty({ example: "LAG-123-EYE" })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  plateNumber!: string;

  @ApiPropertyOptional({ example: 2021 })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ example: "Silver" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional({ example: "1HGCM82633A123456" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  vin?: string;

  @ApiPropertyOptional({
    example: true,
    description: "Optional on create; if true, this vehicle becomes the only primary vehicle for the user",
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateCitizenVehicleDto {
  @ApiPropertyOptional({ example: "Toyota" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  make?: string;

  @ApiPropertyOptional({ example: "Corolla" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  model?: string;

  @ApiPropertyOptional({ example: "LAG-123-EYE" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  plateNumber?: string;

  @ApiPropertyOptional({ example: 2021, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number | null;

  @ApiPropertyOptional({ example: "Silver", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string | null;

  @ApiPropertyOptional({ example: "1HGCM82633A123456", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  vin?: string | null;

  @ApiPropertyOptional({
    example: true,
    description: "When true, this vehicle becomes the only primary vehicle for the user",
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class SetPrimaryCitizenVehicleDto {
  @ApiProperty({
    description: "Explicitly set this vehicle as primary",
    example: true,
  })
  @IsBoolean()
  isPrimary!: boolean;
}

export class VehiclePhotoPresignDto {
  @ApiProperty({ example: "image/jpeg" })
  @IsString()
  @IsIn(["image/jpeg", "image/png", "image/webp"])
  contentType!: string;

  @ApiProperty({ example: "front-bumper.jpg" })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  fileName!: string;

  @ApiPropertyOptional({ example: 420000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  sizeBytes?: number;
}

export class VehiclePhotoConfirmDto {
  @ApiProperty({ example: "vehicles/user-id/vehicle-id/uuid.jpg" })
  @IsString()
  @MinLength(10)
  @MaxLength(240)
  objectKey!: string;

  @ApiProperty({ example: "image/jpeg" })
  @IsString()
  @IsIn(["image/jpeg", "image/png", "image/webp"])
  contentType!: string;

  @ApiProperty({ enum: ["FRONT", "REAR", "SIDE", "OTHER"], example: "FRONT" })
  @IsString()
  @IsIn(["FRONT", "REAR", "SIDE", "OTHER"])
  angle!: "FRONT" | "REAR" | "SIDE" | "OTHER";

  @ApiPropertyOptional({ example: 420000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  sizeBytes?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

