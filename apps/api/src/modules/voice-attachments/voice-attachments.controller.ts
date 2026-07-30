import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/auth/optional-jwt-auth.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { IncidentScopeGuard } from "../../common/auth/incident-scope.guard";
import { VoiceAttachmentsService } from "./voice-attachments.service";

@Controller("v1/incidents")
export class VoiceAttachmentsController {
  constructor(private readonly voice: VoiceAttachmentsService) {}

  @Get(":id/media/:mediaId/voice/playback")
  @UseGuards(OptionalJwtAuthGuard, IncidentScopeGuard, PermissionsGuard)
  @RequirePermissions("incident:read")
  playback(@Param("id") id: string, @Param("mediaId") mediaId: string, @Req() request: any) {
    return this.voice.getPlaybackUrl(id, mediaId, request.user);
  }

  @Post(":id/media/:mediaId/voice/retry-transcription")
  @UseGuards(JwtAuthGuard, IncidentScopeGuard, PermissionsGuard)
  @RequirePermissions("incident:update")
  retry(@Param("id") id: string, @Param("mediaId") mediaId: string, @Req() request: any) {
    return this.voice.retryTranscription(id, mediaId, request.user);
  }

  @Put(":id/media/:mediaId/voice/transcript")
  @UseGuards(JwtAuthGuard, IncidentScopeGuard, PermissionsGuard)
  @RequirePermissions("incident:update")
  correctTranscript(
    @Param("id") id: string,
    @Param("mediaId") mediaId: string,
    @Body() body: { transcript: string },
    @Req() request: any,
  ) {
    return this.voice.correctTranscript(id, mediaId, body.transcript, request.user);
  }

  @Put(":id/media/:mediaId/voice/moderation")
  @UseGuards(JwtAuthGuard, IncidentScopeGuard, PermissionsGuard)
  @RequirePermissions("incident:update")
  updateModeration(
    @Param("id") id: string,
    @Param("mediaId") mediaId: string,
    @Body() body: { moderationStatus: "Approved" | "Flagged" | "Rejected" },
    @Req() request: any,
  ) {
    return this.voice.updateIncidentModeration(id, mediaId, body.moderationStatus, request.user);
  }
}
