import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import {
  AdminCreateSupportChatDto,
  AssignSupportChatDto,
  EscalateSupportChatDto,
  ListSupportChatsQueryDto,
  PresignSupportAttachmentDto,
  SendSupportMessageDto,
  UpdateSupportChatPriorityDto,
  UpdateSupportChatStatusDto,
} from "./dto/support-chats.dto";
import { SupportChatsService } from "./support-chats.service";

@ApiTags("support-chats-admin")
@ApiBearerAuth()
@Controller("support/admin/chats")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SupportChatsAdminController {
  constructor(private readonly supportChats: SupportChatsService) {}

  @Get()
  @RequirePermissions("incident:read")
  list(@Req() request: { user: Parameters<SupportChatsService["list"]>[0] }, @Query() query: ListSupportChatsQueryDto) {
    return this.supportChats.list(request.user, query);
  }

  @Post()
  @RequirePermissions("incident:update")
  create(@Req() request: { user: Parameters<SupportChatsService["create"]>[0] }, @Body() dto: AdminCreateSupportChatDto) {
    return this.supportChats.create(request.user, dto);
  }

  @Get(":id")
  @RequirePermissions("incident:read")
  getById(@Req() request: { user: Parameters<SupportChatsService["getById"]>[0] }, @Param("id") id: string) {
    return this.supportChats.getById(request.user, id);
  }

  @Post(":id/assign")
  @RequirePermissions("incident:assign")
  assign(
    @Req() request: { user: Parameters<SupportChatsService["assign"]>[0] },
    @Param("id") id: string,
    @Body() dto: AssignSupportChatDto,
  ) {
    return this.supportChats.assign(request.user, id, dto);
  }

  @Post(":id/reply")
  @RequirePermissions("incident:update")
  reply(
    @Req() request: { user: Parameters<SupportChatsService["adminReply"]>[0] },
    @Param("id") id: string,
    @Body() dto: SendSupportMessageDto,
  ) {
    return this.supportChats.adminReply(request.user, id, dto);
  }

  @Post(":id/internal-note")
  @RequirePermissions("support:internal-note:create")
  internalNote(
    @Req() request: { user: Parameters<SupportChatsService["internalNote"]>[0] },
    @Param("id") id: string,
    @Body() dto: SendSupportMessageDto,
  ) {
    return this.supportChats.internalNote(request.user, id, dto);
  }

  @Post(":id/escalate")
  @RequirePermissions("incident:escalate")
  escalate(
    @Req() request: { user: Parameters<SupportChatsService["escalate"]>[0] },
    @Param("id") id: string,
    @Body() dto: EscalateSupportChatDto,
  ) {
    return this.supportChats.escalate(request.user, id, dto);
  }

  @Post(":id/resolve")
  @RequirePermissions("incident:update")
  resolve(
    @Req() request: { user: Parameters<SupportChatsService["resolve"]>[0] },
    @Param("id") id: string,
    @Body() dto: UpdateSupportChatStatusDto,
  ) {
    return this.supportChats.resolve(request.user, id, dto);
  }

  @Post(":id/close")
  @RequirePermissions("incident:update")
  close(
    @Req() request: { user: Parameters<SupportChatsService["close"]>[0] },
    @Param("id") id: string,
    @Body() dto: UpdateSupportChatStatusDto,
  ) {
    return this.supportChats.close(request.user, id, dto);
  }

  @Post(":id/reopen")
  @RequirePermissions("incident:update")
  reopen(@Req() request: { user: Parameters<SupportChatsService["reopen"]>[0] }, @Param("id") id: string) {
    return this.supportChats.reopen(request.user, id);
  }

  @Post(":id/spam")
  @RequirePermissions("support:chat:moderate")
  spam(
    @Req() request: { user: Parameters<SupportChatsService["markSpam"]>[0] },
    @Param("id") id: string,
    @Body() dto: UpdateSupportChatStatusDto,
  ) {
    return this.supportChats.markSpam(request.user, id, dto);
  }

  @Patch(":id/status")
  @RequirePermissions("support:chat:resolve", "incident:update")
  updateStatus(
    @Req() request: { user: Parameters<SupportChatsService["updateStatus"]>[0] },
    @Param("id") id: string,
    @Body() dto: UpdateSupportChatStatusDto,
  ) {
    return this.supportChats.updateStatus(request.user, id, dto);
  }

  @Patch(":id/priority")
  @RequirePermissions("incident:update")
  updatePriority(
    @Req() request: { user: Parameters<SupportChatsService["updatePriority"]>[0] },
    @Param("id") id: string,
    @Body() dto: UpdateSupportChatPriorityDto,
  ) {
    return this.supportChats.updatePriority(request.user, id, dto);
  }

  @Post(":id/attachments/presign")
  @RequirePermissions("incident:update")
  presignAttachment(
    @Req() request: { user: Parameters<SupportChatsService["presignAdminAttachment"]>[0] },
    @Param("id") id: string,
    @Body() dto: PresignSupportAttachmentDto,
  ) {
    return this.supportChats.presignAdminAttachment(request.user, id, dto);
  }

  @Get(":id/messages/:messageId/attachment-url")
  @RequirePermissions("incident:read")
  attachmentUrl(
    @Req() request: { user: Parameters<SupportChatsService["getAttachmentUrl"]>[0] },
    @Param("id") id: string,
    @Param("messageId") messageId: string,
  ) {
    return this.supportChats.getAttachmentUrl(request.user, id, messageId);
  }
}
