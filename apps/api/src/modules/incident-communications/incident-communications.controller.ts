import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IncidentScopeGuard } from "../../common/auth/incident-scope.guard";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import {
  CloseConversationDto,
  CreateInformationRequestDto,
  ReportMessageDto,
  RestrictConversationDto,
  SendIncidentMessageDto,
} from "./dto/incident-communications.dto";
import { IncidentCommunicationsService } from "./incident-communications.service";

@ApiTags("incident-communications")
@Controller("incidents")
export class IncidentCommunicationsController {
  constructor(private readonly communications: IncidentCommunicationsService) {}

  @Get(":incidentId/conversation")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard, IncidentScopeGuard)
  @RequirePermissions("incident:read")
  getConversation(@Param("incidentId") incidentId: string, @Req() request: { user: never }) {
    return this.communications.getConversation(incidentId, request.user);
  }

  @Get(":incidentId/messages")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard, IncidentScopeGuard)
  @RequirePermissions("incident:read")
  listMessages(
    @Param("incidentId") incidentId: string,
    @Req() request: { user: never },
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.communications.listMessages(incidentId, request.user, { cursor, limit });
  }

  @Post(":incidentId/messages")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard, IncidentScopeGuard)
  @RequirePermissions("incident:read")
  @RateLimit("incidentUpdate")
  sendMessage(
    @Param("incidentId") incidentId: string,
    @Body() dto: SendIncidentMessageDto,
    @Req() request: { user: never },
  ) {
    return this.communications.sendMessage(incidentId, request.user, dto);
  }

  @Patch(":incidentId/messages/:messageId/read")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard, IncidentScopeGuard)
  @RequirePermissions("incident:read")
  markRead(
    @Param("incidentId") incidentId: string,
    @Param("messageId") messageId: string,
    @Req() request: { user: never },
  ) {
    return this.communications.markRead(incidentId, messageId, request.user);
  }

  @Post(":incidentId/messages/:messageId/report")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard, IncidentScopeGuard)
  @RequirePermissions("incident:read")
  reportMessage(
    @Param("incidentId") incidentId: string,
    @Param("messageId") messageId: string,
    @Body() dto: ReportMessageDto,
    @Req() request: { user: never },
  ) {
    return this.communications.reportMessage(incidentId, messageId, request.user, dto);
  }

  @Post(":incidentId/conversation/restrict")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard, IncidentScopeGuard)
  @RequirePermissions("incident:update")
  restrictConversation(
    @Param("incidentId") incidentId: string,
    @Body() dto: RestrictConversationDto,
    @Req() request: { user: never },
  ) {
    return this.communications.restrictConversation(incidentId, request.user, dto);
  }

  @Post(":incidentId/conversation/close")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard, IncidentScopeGuard)
  @RequirePermissions("incident:update")
  closeConversation(
    @Param("incidentId") incidentId: string,
    @Body() dto: CloseConversationDto,
    @Req() request: { user: never },
  ) {
    return this.communications.closeConversation(incidentId, request.user, dto);
  }

  @Post(":incidentId/information-requests")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard, IncidentScopeGuard)
  @RequirePermissions("incident:update")
  createInformationRequest(
    @Param("incidentId") incidentId: string,
    @Body() dto: CreateInformationRequestDto,
    @Req() request: { user: never },
  ) {
    return this.communications.createInformationRequest(incidentId, request.user, dto);
  }
}
