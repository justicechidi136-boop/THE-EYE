import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export enum SupportChatTypeDto {
  Incident = "Incident",
  CitizenSupport = "CitizenSupport",
  Agency = "Agency",
  Responder = "Responder",
}

export enum SupportChatStatusDto {
  Open = "Open",
  Pending = "Pending",
  Escalated = "Escalated",
  Closed = "Closed",
}

export enum SupportChatPriorityDto {
  Urgent = "Urgent",
  High = "High",
  Normal = "Normal",
  Low = "Low",
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
}

export class SendSupportMessageDto {
  @ApiProperty()
  @IsString()
  @MaxLength(8000)
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
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
