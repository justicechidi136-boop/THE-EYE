import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import {
  CreateInformationRequestDto,
  SendIncidentMessageDto,
} from "../incident-communications/dto/incident-communications.dto";
import { IncidentCommunicationsService } from "../incident-communications/incident-communications.service";

@ApiTags("field-comms")
@Controller("field/incidents")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class FieldCommsController {
  constructor(private readonly communications: IncidentCommunicationsService) {}

  @Get(":incidentId/conversation")
  @RequirePermissions("field:session:operate")
  getConversation(@Param("incidentId") incidentId: string, @Req() request: { user: never }) {
    return this.communications.getConversation(incidentId, request.user);
  }

  @Get(":incidentId/messages")
  @RequirePermissions("field:session:operate")
  listMessages(
    @Param("incidentId") incidentId: string,
    @Req() request: { user: never },
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.communications.listMessages(incidentId, request.user, { cursor, limit });
  }

  @Post(":incidentId/messages")
  @RequirePermissions("field:session:operate")
  @RateLimit("incidentCreate")
  sendMessage(@Param("incidentId") incidentId: string, @Req() request: { user: never }, @Body() dto: SendIncidentMessageDto) {
    return this.communications.sendMessage(incidentId, request.user, dto);
  }

  @Patch(":incidentId/messages/:messageId/read")
  @RequirePermissions("field:session:operate")
  markRead(
    @Param("incidentId") incidentId: string,
    @Param("messageId") messageId: string,
    @Req() request: { user: never },
  ) {
    return this.communications.markRead(incidentId, messageId, request.user);
  }

  @Post(":incidentId/information-requests")
  @RequirePermissions("field:session:operate")
  createInformationRequest(
    @Param("incidentId") incidentId: string,
    @Req() request: { user: never },
    @Body() dto: CreateInformationRequestDto,
  ) {
    return this.communications.createInformationRequest(incidentId, request.user, dto);
  }
}
