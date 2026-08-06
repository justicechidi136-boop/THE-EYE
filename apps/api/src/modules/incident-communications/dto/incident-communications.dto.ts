import { BadRequestException } from "@nestjs/common";

export class SendIncidentMessageDto {
  clientMessageId!: string;
  messageType!: string;
  body?: string;
  attachmentId?: string;
  structuredAction?: Record<string, unknown>;
  replyToMessageId?: string;
  metadata?: Record<string, unknown>;
}

export class CreateInformationRequestDto {
  requestType!: string;
  customPrompt?: string;
  required?: boolean;
  expiresInMinutes?: number;
}

export class RestrictConversationDto {
  reason!: string;
}

export class CloseConversationDto {
  reason?: string;
}

export class ReportMessageDto {
  reason!: string;
  details?: string;
}

const REPORTER_TYPES = new Set([
  "Text",
  "Voice",
  "Image",
  "Video",
  "QuickReply",
  "LocationUpdate",
]);

const OFFICIAL_TYPES = new Set([
  "Text",
  "Voice",
  "Image",
  "Video",
  "OfficialNotice",
  "SafetyInstruction",
  "InformationRequest",
  "SystemUpdate",
]);

export function validateSendIncidentMessageDto(dto: SendIncidentMessageDto, official = false) {
  if (!dto.clientMessageId?.trim()) throw new BadRequestException("clientMessageId is required");
  if (!dto.messageType?.trim()) throw new BadRequestException("messageType is required");
  const allowed = official ? OFFICIAL_TYPES : REPORTER_TYPES;
  if (!allowed.has(dto.messageType)) {
    throw new BadRequestException(`Message type ${dto.messageType} is not permitted`);
  }
  const needsBody = dto.messageType === "Text" || dto.messageType === "OfficialNotice" || dto.messageType === "SafetyInstruction";
  if (needsBody && !dto.body?.trim()) {
    throw new BadRequestException("body is required for text messages");
  }
  if (["Voice", "Image", "Video"].includes(dto.messageType) && !dto.attachmentId?.trim()) {
    throw new BadRequestException("attachmentId is required for media messages");
  }
  if (dto.messageType === "QuickReply" && !dto.structuredAction) {
    throw new BadRequestException("structuredAction is required for quick replies");
  }
}
