import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/auth/optional-jwt-auth.guard";
import { Permissions } from "../../common/auth/permissions.decorator";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { IncidentScopeGuard } from "../../common/auth/incident-scope.guard";
import { VoiceAttachmentsService } from "./voice-attachments.service";

@Controller("v1/incidents")
export class VoiceAttachmentsController {
  constructor(private readonly voice: VoiceAttachmentsService) {}

  @Get(":id/media/:mediaId/voice/playback")
  @UseGuards(OptionalJwtAuthGuard, IncidentScopeGuard, PermissionsGuard)
  @Permissions("incident:read")
  playback(@Param("id") id: string, @Param("mediaId") mediaId: string, @Req() request: any) {
    return this.voice.getPlaybackUrl(id, mediaId, request.user);
  }

  @Post(":id/media/:mediaId/voice/retry-transcription")
  @UseGuards(JwtAuthGuard, IncidentScopeGuard, PermissionsGuard)
  @Permissions("incident:manage")
  retry(@Param("id") id: string, @Param("mediaId") mediaId: string, @Req() request: any) {
    return this.voice.retryTranscription(id, mediaId, request.user);
  }

  @Put(":id/media/:mediaId/voice/transcript")
  @UseGuards(JwtAuthGuard, IncidentScopeGuard, PermissionsGuard)
  @Permissions("incident:manage")
  correctTranscript(
    @Param("id") id: string,
    @Param("mediaId") mediaId: string,
    @Body() body: { transcript: string },
    @Req() request: any,
  ) {
    return this.voice.correctTranscript(id, mediaId, body.transcript, request.user);
  }
}
