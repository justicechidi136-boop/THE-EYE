import { IsObject, IsOptional, IsString, IsUUID } from "class-validator";

export class UpsertPolicyDto {
  @IsOptional()
  @IsString()
  scope?: "platform" | "jurisdiction" | "community";

  @IsOptional()
  @IsUUID()
  communityId?: string;

  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  changeReason?: string;
}

export class UpdateAdminPreferencesDto {
  @IsOptional()
  @IsString()
  theme?: string;

  @IsOptional()
  @IsString()
  preferredLocale?: string | null;

  @IsOptional()
  @IsObject()
  notificationPrefs?: Record<string, unknown>;
}
