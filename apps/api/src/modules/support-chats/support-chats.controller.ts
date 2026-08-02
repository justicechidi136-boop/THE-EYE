import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import {
  AssignSupportChatDto,
  CreateSupportChatDto,
  ListSupportChatsQueryDto,
  SendSupportMessageDto,
  UpdateSupportChatPriorityDto,
  UpdateSupportChatStatusDto,
} from "./dto/support-chats.dto";
import { SupportChatsService } from "./support-chats.service";

@ApiTags("support-chats")
@ApiBearerAuth()
@Controller("support/chats")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SupportChatsController {
  constructor(private readonly supportChats: SupportChatsService) {}

  @Get()
  @RequirePermissions("incident:read")
  list(@Req() request: { user: Parameters<SupportChatsService["list"]>[0] }, @Query() query: ListSupportChatsQueryDto) {
    return this.supportChats.list(request.user, query);
  }

  @Post()
  @RequirePermissions("incident:update")
  create(@Req() request: { user: Parameters<SupportChatsService["create"]>[0] }, @Body() dto: CreateSupportChatDto) {
    return this.supportChats.create(request.user, dto);
  }

  @Get(":id")
  @RequirePermissions("incident:read")
  getById(@Req() request: { user: Parameters<SupportChatsService["getById"]>[0] }, @Param("id") id: string) {
    return this.supportChats.getById(request.user, id);
  }

  @Patch(":id/assign")
  @RequirePermissions("incident:update")
  assign(
    @Req() request: { user: Parameters<SupportChatsService["assign"]>[0] },
    @Param("id") id: string,
    @Body() dto: AssignSupportChatDto,
  ) {
    return this.supportChats.assign(request.user, id, dto);
  }

  @Post(":id/messages")
  @RequirePermissions("incident:update")
  sendMessage(
    @Req() request: { user: Parameters<SupportChatsService["sendMessage"]>[0] },
    @Param("id") id: string,
    @Body() dto: SendSupportMessageDto,
  ) {
    return this.supportChats.sendMessage(request.user, id, dto);
  }

  @Patch(":id/status")
  @RequirePermissions("incident:update")
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
}
