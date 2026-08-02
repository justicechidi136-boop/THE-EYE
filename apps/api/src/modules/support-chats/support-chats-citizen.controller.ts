import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import { RateLimitGuard } from "../../common/rate-limit/rate-limit.guard";
import {
  ConfirmSupportAttachmentDto,
  CreateSupportChatDto,
  ListSupportChatsQueryDto,
  PresignSupportAttachmentDto,
  SendSupportMessageDto,
} from "./dto/support-chats.dto";
import { SupportChatsService } from "./support-chats.service";

@ApiTags("support-chats-citizen")
@ApiBearerAuth()
@Controller("support/chats")
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class SupportChatsCitizenController {
  constructor(private readonly supportChats: SupportChatsService) {}

  @Get()
  list(@Req() request: { user: Parameters<SupportChatsService["listMine"]>[0] }, @Query() query: ListSupportChatsQueryDto) {
    return this.supportChats.listMine(request.user, query);
  }

  @Post()
  @RateLimit("communityPostCreate")
  create(@Req() request: { user: Parameters<SupportChatsService["createMine"]>[0] }, @Body() dto: CreateSupportChatDto) {
    return this.supportChats.createMine(request.user, dto);
  }

  @Get(":id")
  getById(@Req() request: { user: Parameters<SupportChatsService["getMine"]>[0] }, @Param("id") id: string) {
    return this.supportChats.getMine(request.user, id);
  }

  @Post(":id/messages")
  @RateLimit("communityPostCreate")
  sendMessage(
    @Req() request: { user: Parameters<SupportChatsService["sendCitizenMessage"]>[0] },
    @Param("id") id: string,
    @Body() dto: SendSupportMessageDto,
  ) {
    return this.supportChats.sendCitizenMessage(request.user, id, dto);
  }

  @Patch(":id/read")
  markRead(@Req() request: { user: Parameters<SupportChatsService["markRead"]>[0] }, @Param("id") id: string) {
    return this.supportChats.markRead(request.user, id);
  }

  @Post(":id/close")
  close(@Req() request: { user: Parameters<SupportChatsService["closeMine"]>[0] }, @Param("id") id: string) {
    return this.supportChats.closeMine(request.user, id);
  }

  @Post(":id/reopen")
  reopen(@Req() request: { user: Parameters<SupportChatsService["reopenMine"]>[0] }, @Param("id") id: string) {
    return this.supportChats.reopenMine(request.user, id);
  }

  @Post(":id/attachments/presign")
  presignAttachment(
    @Req() request: { user: Parameters<SupportChatsService["presignAttachment"]>[0] },
    @Param("id") id: string,
    @Body() dto: PresignSupportAttachmentDto,
  ) {
    return this.supportChats.presignAttachment(request.user, id, dto);
  }

  @Post(":id/attachments/confirm")
  confirmAttachment(
    @Req() request: { user: Parameters<SupportChatsService["confirmAttachment"]>[0] },
    @Param("id") id: string,
    @Body() dto: ConfirmSupportAttachmentDto,
  ) {
    return this.supportChats.confirmAttachment(request.user, id, dto);
  }

  @Get(":id/messages/:messageId/attachment-url")
  attachmentUrl(
    @Req() request: { user: Parameters<SupportChatsService["getAttachmentUrl"]>[0] },
    @Param("id") id: string,
    @Param("messageId") messageId: string,
  ) {
    return this.supportChats.getAttachmentUrl(request.user, id, messageId);
  }
}
