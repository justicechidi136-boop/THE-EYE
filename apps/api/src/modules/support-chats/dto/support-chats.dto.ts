import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

export enum SupportChatTypeDto {
  Incident = "Incident",
  CitizenSupport = "CitizenSupport",
  Agency = "Agency",
  Responder = "Responder",
}

export enum SupportChatStatusDto {
  Open = "Open",
  Pending = "Pending",
  WaitingForAdmin = "WaitingForAdmin",
  WaitingForUser = "WaitingForUser",
  Assigned = "Assigned",
  Escalated = "Escalated",
  Resolved = "Resolved",
  Closed = "Closed",
  Reopened = "Reopened",
  Spam = "Spam",
  Abusive = "Abusive",
}

export enum SupportChatCategoryDto {
  EmergencyReport = "EmergencyReport",
  LiveVideo = "LiveVideo",
  AccountAccess = "AccountAccess",
  Location = "Location",
  PoliceLocator = "PoliceLocator",
  Smartwatch = "Smartwatch",
  WhistleblowerReward = "WhistleblowerReward",
  Withdrawal = "Withdrawal",
  Community = "Community",
  EvidenceUpload = "EvidenceUpload",
  Notification = "Notification",
  SafetyConcern = "SafetyConcern",
  AbuseReport = "AbuseReport",
  TechnicalIssue = "TechnicalIssue",
  Other = "Other",
}

export enum SupportChatPriorityDto {
  Urgent = "Urgent",
  High = "High",
  Normal = "Normal",
  Low = "Low",
}

export enum SupportMessageTypeDto {
  Text = "Text",
  Voice = "Voice",
  Image = "Image",
  Document = "Document",
  System = "System",
  IncidentLink = "IncidentLink",
  LocationUpdate = "LocationUpdate",
}

export class ListSupportChatsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional({ enum: SupportChatStatusDto })
  @IsOptional()
  @IsEnum(SupportChatStatusDto)
  status?: SupportChatStatusDto;

  @ApiPropertyOptional({ enum: SupportChatPriorityDto })
  @IsOptional()
  @IsEnum(SupportChatPriorityDto)
  priority?: SupportChatPriorityDto;

  @ApiPropertyOptional({ enum: SupportChatCategoryDto })
  @IsOptional()
  @IsEnum(SupportChatCategoryDto)
  category?: SupportChatCategoryDto;

  @ApiPropertyOptional({ enum: SupportChatTypeDto })
  @IsOptional()
  @IsEnum(SupportChatTypeDto)
  type?: SupportChatTypeDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  incidentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedAdminId?: string;
}

export class AssignSupportChatDto {
  @ApiProperty()
  @IsUUID()
  adminId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  team?: string;
}

export class SendSupportMessageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientMessageId?: string;

  @ApiPropertyOptional({ enum: SupportMessageTypeDto })
  @IsOptional()
  @IsEnum(SupportMessageTypeDto)
  messageType?: SupportMessageTypeDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  replyToMessageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  attachmentKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  attachmentMimeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  attachmentSizeBytes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  attachmentDurationSeconds?: number;
}

export class UpdateSupportChatStatusDto {
  @ApiProperty({ enum: SupportChatStatusDto })
  @IsEnum(SupportChatStatusDto)
  status!: SupportChatStatusDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpdateSupportChatPriorityDto {
  @ApiProperty({ enum: SupportChatPriorityDto })
  @IsEnum(SupportChatPriorityDto)
  priority!: SupportChatPriorityDto;
}

export class CreateSupportChatDto {
  @ApiPropertyOptional({ enum: SupportChatTypeDto })
  @IsOptional()
  @IsEnum(SupportChatTypeDto)
  type?: SupportChatTypeDto;

  @ApiProperty({ enum: SupportChatCategoryDto })
  @IsEnum(SupportChatCategoryDto)
  category!: SupportChatCategoryDto;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  subject!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  body?: string;

  @ApiPropertyOptional({ enum: SupportChatPriorityDto })
  @IsOptional()
  @IsEnum(SupportChatPriorityDto)
  priority?: SupportChatPriorityDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  incidentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  linkedReportId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  linkedWithdrawalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  linkedWatchDeviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  linkedCommunityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  anonymousMode?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  preferredLanguage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientMessageId?: string;

  @ApiPropertyOptional({ enum: SupportMessageTypeDto })
  @IsOptional()
  @IsEnum(SupportMessageTypeDto)
  messageType?: SupportMessageTypeDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  attachmentKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  diagnosticMetadata?: Record<string, unknown>;
}

export class PresignSupportAttachmentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  fileName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  contentType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  sizeBytes?: number;
}

export class ConfirmSupportAttachmentDto {
  @ApiProperty()
  @IsString()
  objectKey!: string;

  @ApiProperty()
  @IsString()
  contentType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  sizeBytes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  durationSeconds?: number;
}

export class EscalateSupportChatDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  incidentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AdminCreateSupportChatDto {
  @ApiProperty({ enum: SupportChatTypeDto })
  @IsEnum(SupportChatTypeDto)
  type!: SupportChatTypeDto;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  subject!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  incidentId?: string;

  @ApiPropertyOptional({ enum: SupportChatPriorityDto })
  @IsOptional()
  @IsEnum(SupportChatPriorityDto)
  priority?: SupportChatPriorityDto;
}
