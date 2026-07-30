import { Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { VoiceAttachmentsService } from "./voice-attachments.service";

@Controller("v1/neighborhood-watch/posts")
export class CommunityVoiceAttachmentsController {
  constructor(private readonly voice: VoiceAttachmentsService) {}

  @Get(":postId/media/:mediaId/voice/playback")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("community:read")
  playback(@Param("postId") postId: string, @Param("mediaId") mediaId: string, @Req() request: any) {
    return this.voice.getCommunityPostPlaybackUrl(postId, mediaId, request.user);
  }

  @Post(":postId/media/:mediaId/voice/retry-transcription")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("community:moderate")
  retry(@Param("postId") postId: string, @Param("mediaId") mediaId: string, @Req() request: any) {
    return this.voice.retryCommunityPostTranscription(postId, mediaId, request.user);
  }
}
