import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import {
  AssignCommunityRoleDto,
  CreateCommunityAlertDto,
  CreateCommunityCommentDto,
  CreateCommunityContentReportDto,
  CreateCommunityDto,
  CreateCommunityPostDto,
  CreateCommunityReactionDto,
  CreateCommunityRequestDto,
  CreatePatrolObservationDto,
  CreatePatrolScheduleDto,
  CreatePinnedSafetyInfoDto,
  ModerateMemberDto,
  PatrolCheckpointDto,
  PresignCommunityMediaDto,
  RegisterVolunteerDto,
  ReviewCommunityRequestDto,
  SendCommunityMessageDto,
  SetHomeCommunityDto,
  UpdateCommunityAlertDto,
  UpdateCommunityCommentDto,
  UpdateCommunityDto,
  UpdatePatrolScheduleDto,
  UpdatePinnedSafetyInfoDto,
  UpdateVolunteerAdminDto,
  VerifyCommunityPostDto,
} from "./dto/neighborhood-watch.dto";
import { NeighborhoodWatchService } from "./neighborhood-watch.service";
import { NeighborhoodWatchContextService } from "./neighborhood-watch-context.service";
import { AiIntelligenceService } from "./ai-intelligence.service";
import { VoiceAttachmentsService } from "../voice-attachments/voice-attachments.service";

@ApiTags("neighborhood-watch")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("neighborhood-watch")
export class NeighborhoodWatchController {
  constructor(
    private readonly neighborhoodWatch: NeighborhoodWatchService,
    private readonly contextService: NeighborhoodWatchContextService,
    private readonly aiIntelligenceService: AiIntelligenceService,
    private readonly voiceAttachments: VoiceAttachmentsService,
  ) {}

  @Get("context")
  @RequirePermissions("community:read")
  resolveContext(
    @Req() request: any,
    @Query("lat") lat?: string,
    @Query("lng") lng?: string,
    @Query("accuracy") accuracy?: string,
    @Query("capturedAt") capturedAt?: string,
  ) {
    return this.contextService.resolveContext(request.user, { lat, lng, accuracy, capturedAt });
  }

  @Put("home-community")
  @RequirePermissions("community:join")
  setHomeCommunityPut(@Body() body: SetHomeCommunityDto, @Req() request: any) {
    return this.contextService.setHomeCommunity(request.user, body.communityId ?? null);
  }

  @Patch("home-community")
  @RequirePermissions("community:join")
  setHomeCommunity(@Body() body: SetHomeCommunityDto, @Req() request: any) {
    return this.contextService.setHomeCommunity(request.user, body.communityId ?? null);
  }

  @Get("communities")
  @RequirePermissions("community:read")
  listCommunities(@Req() request: any, @Query() query: Record<string, string | undefined>) {
    return this.neighborhoodWatch.listCommunities(request.user, query);
  }

  @Post("communities")
  @RequirePermissions("community:moderate")
  createCommunity(@Body() dto: CreateCommunityDto, @Req() request: any) {
    return this.neighborhoodWatch.createCommunity(dto, request.user);
  }

  @Post("community-requests")
  @RequirePermissions("community:join")
  createCommunityRequest(@Body() dto: CreateCommunityRequestDto, @Req() request: any) {
    return this.neighborhoodWatch.createCommunityRequest(dto, request.user);
  }

  @Get("community-requests")
  @RequirePermissions("community:read")
  listCommunityRequests(@Req() request: any) {
    return this.neighborhoodWatch.listCommunityRequests(request.user);
  }

  @Patch("community-requests/:requestId")
  @RequirePermissions("community:moderate")
  reviewCommunityRequest(@Param("requestId") requestId: string, @Body() dto: ReviewCommunityRequestDto, @Req() request: any) {
    return this.neighborhoodWatch.reviewCommunityRequest(requestId, dto, request.user);
  }

  @Get("communities/:communityId")
  @RequirePermissions("community:read")
  getCommunity(@Param("communityId") communityId: string, @Req() request: any) {
    return this.neighborhoodWatch.getCommunity(communityId, request.user);
  }

  @Patch("communities/:communityId")
  @RequirePermissions("community:moderate")
  updateCommunity(@Param("communityId") communityId: string, @Body() dto: UpdateCommunityDto, @Req() request: any) {
    return this.neighborhoodWatch.updateCommunity(communityId, dto, request.user);
  }

  @Get("communities/:communityId/boundary")
  @RequirePermissions("community:moderate")
  getCommunityBoundary(@Param("communityId") communityId: string, @Req() request: any) {
    return this.neighborhoodWatch.getCommunityBoundary(communityId, request.user);
  }

  @Get("communities/:communityId/members")
  @RequirePermissions("community:read")
  listMembers(
    @Param("communityId") communityId: string,
    @Req() request: any,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
  ) {
    return this.neighborhoodWatch.listMembers(communityId, request.user, { cursor, limit, search });
  }

  @Get("communities/:communityId/statistics")
  @RequirePermissions("community:read")
  statistics(@Param("communityId") communityId: string, @Req() request: any) {
    return this.neighborhoodWatch.getCommunityStatistics(communityId, request.user);
  }

  @Post("communities/:communityId/join")
  @RequirePermissions("community:join")
  join(@Param("communityId") communityId: string, @Req() request: any) {
    return this.neighborhoodWatch.joinCommunity(communityId, request.user);
  }

  @Patch("communities/:communityId/memberships/:membershipId/approve")
  @RequirePermissions("community:moderate")
  approveMember(@Param("communityId") communityId: string, @Param("membershipId") membershipId: string, @Req() request: any) {
    return this.neighborhoodWatch.approveMember(communityId, membershipId, request.user);
  }

  @Patch("communities/:communityId/memberships/:membershipId/reject")
  @RequirePermissions("community:moderate")
  rejectMember(@Param("communityId") communityId: string, @Param("membershipId") membershipId: string, @Body() dto: { note?: string }, @Req() request: any) {
    return this.neighborhoodWatch.rejectMember(communityId, membershipId, request.user, dto.note);
  }

  @Patch("communities/:communityId/memberships/:membershipId/role")
  @RequirePermissions("community:moderate")
  assignRole(@Param("communityId") communityId: string, @Param("membershipId") membershipId: string, @Body() dto: AssignCommunityRoleDto, @Req() request: any) {
    return this.neighborhoodWatch.assignMemberRole(communityId, membershipId, dto, request.user);
  }

  @Patch("communities/:communityId/memberships/:membershipId/moderate")
  @RequirePermissions("community:moderate")
  moderateMember(
    @Param("communityId") communityId: string,
    @Param("membershipId") membershipId: string,
    @Body() dto: ModerateMemberDto,
    @Req() request: any,
  ) {
    return this.neighborhoodWatch.moderateMember(communityId, membershipId, dto, request.user);
  }

  @Patch("communities/:communityId/leave")
  @RequirePermissions("community:join")
  leave(@Param("communityId") communityId: string, @Req() request: any) {
    return this.neighborhoodWatch.leaveCommunity(communityId, request.user);
  }

  @Get("posts")
  @RequirePermissions("community:read")
  listPosts(@Req() request: any, @Query("cursor") cursor?: string, @Query("limit") limit?: string) {
    return this.neighborhoodWatch.listPosts(request.user, { cursor, limit });
  }

  @Get("posts/:postId")
  @RequirePermissions("community:read")
  getPost(@Param("postId") postId: string, @Req() request: any) {
    return this.neighborhoodWatch.getPost(postId, request.user);
  }

  @Get("posts/:postId/media/:mediaId/voice")
  @RequirePermissions("community:read")
  async getPostVoice(
    @Param("postId") postId: string,
    @Param("mediaId") mediaId: string,
    @Query("targetLocale") targetLocale: string | undefined,
    @Req() request: any,
  ) {
    await this.neighborhoodWatch.getPost(postId, request.user);
    return this.voiceAttachments.getCommunityPostVoice(postId, mediaId, targetLocale);
  }

  @Post("posts/:postId/media/:mediaId/voice/translations")
  @RequirePermissions("community:read")
  async translatePostVoice(
    @Param("postId") postId: string,
    @Param("mediaId") mediaId: string,
    @Body() body: { targetLocale?: string },
    @Req() request: any,
  ) {
    await this.neighborhoodWatch.getPost(postId, request.user);
    return this.voiceAttachments.requestCommunityPostTranslation(postId, mediaId, body.targetLocale);
  }

  @Post("posts/:postId/media/:mediaId/voice/synthesis")
  @RequirePermissions("community:read")
  async synthesizePostVoice(
    @Param("postId") postId: string,
    @Param("mediaId") mediaId: string,
    @Body() body: { targetLocale?: string },
    @Req() request: any,
  ) {
    await this.neighborhoodWatch.getPost(postId, request.user);
    return this.voiceAttachments.requestCommunityPostSynthesis(postId, mediaId, body.targetLocale);
  }

  @Get("communities/:communityId/feed")
  @RequirePermissions("community:read")
  feed(
    @Param("communityId") communityId: string,
    @Req() request: any,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.neighborhoodWatch.feed(communityId, request.user, { cursor, limit });
  }

  /** Alias for feed — public conversation list contract. */
  @Get("communities/:communityId/posts")
  @RequirePermissions("community:read")
  listCommunityPosts(
    @Param("communityId") communityId: string,
    @Req() request: any,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.neighborhoodWatch.feed(communityId, request.user, { cursor, limit });
  }

  @Get("communities/:communityId/alerts")
  @RequirePermissions("community:read")
  listAlerts(
    @Param("communityId") communityId: string,
    @Req() request: any,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.neighborhoodWatch.listAlerts(communityId, request.user, { cursor, limit });
  }

  @Post("communities/:communityId/posts/media/presign")
  @RequirePermissions("community:post")
  presignMedia(@Param("communityId") communityId: string, @Body() dto: PresignCommunityMediaDto, @Req() request: any) {
    return this.neighborhoodWatch.presignPostMedia(communityId, dto, request.user);
  }

  @Post("communities/:communityId/posts")
  @RateLimit("communityPostCreate")
  @RequirePermissions("community:post")
  createPost(@Param("communityId") communityId: string, @Body() dto: CreateCommunityPostDto, @Req() request: any) {
    return this.neighborhoodWatch.createPost(communityId, dto, request.user);
  }

  @Get("dynamic-areas/feed")
  @RequirePermissions("community:read")
  feedDynamicArea(@Req() request: any, @Query("cursor") cursor?: string, @Query("limit") limit?: string) {
    return this.neighborhoodWatch.feedDynamicArea(request.user, { cursor, limit });
  }

  @Post("dynamic-areas/posts/media/presign")
  @RequirePermissions("community:post")
  presignDynamicAreaMedia(@Body() dto: PresignCommunityMediaDto, @Req() request: any) {
    return this.neighborhoodWatch.presignDynamicAreaMedia(dto, request.user);
  }

  @Post("dynamic-areas/posts")
  @RateLimit("communityPostCreate")
  @RequirePermissions("community:post")
  createDynamicAreaPost(@Body() dto: CreateCommunityPostDto, @Req() request: any) {
    return this.neighborhoodWatch.createDynamicAreaPost(dto, request.user);
  }

  @Post("dynamic-areas/reports")
  @RateLimit("communityPostCreate")
  @RequirePermissions("community:post")
  reportDynamicAreaContent(@Body() dto: CreateCommunityContentReportDto, @Req() request: any) {
    return this.neighborhoodWatch.createDynamicAreaContentReport(dto, request.user);
  }

  @Get("admin/dynamic-area-posts")
  @RequirePermissions("community:moderate")
  listAdminDynamicAreaPosts(@Req() request: any, @Query() query: Record<string, string | undefined>) {
    return this.neighborhoodWatch.listAdminDynamicAreaPosts(request.user, query);
  }

  @Get("posts/:postId/comments")
  @RequirePermissions("community:read")
  listComments(@Param("postId") postId: string, @Req() request: any, @Query("cursor") cursor?: string, @Query("limit") limit?: string) {
    return this.neighborhoodWatch.listPostComments(postId, request.user, { cursor, limit });
  }

  @Post("posts/:postId/comments")
  @RateLimit("communityPostCreate")
  @RequirePermissions("community:post")
  createComment(@Param("postId") postId: string, @Body() dto: CreateCommunityCommentDto, @Req() request: any) {
    return this.neighborhoodWatch.createPostComment(postId, dto, request.user);
  }

  @Patch("posts/:postId/comments/:commentId")
  @RequirePermissions("community:post")
  updateComment(@Param("commentId") commentId: string, @Body() dto: UpdateCommunityCommentDto, @Req() request: any) {
    return this.neighborhoodWatch.updatePostComment(commentId, dto, request.user);
  }

  @Delete("posts/:postId/comments/:commentId")
  @RequirePermissions("community:post")
  deleteComment(@Param("commentId") commentId: string, @Req() request: any) {
    return this.neighborhoodWatch.deletePostComment(commentId, request.user);
  }

  @Post("posts/:postId/reactions")
  @RateLimit("communityPostCreate")
  @RequirePermissions("community:post")
  createReaction(@Param("postId") postId: string, @Body() dto: CreateCommunityReactionDto, @Req() request: any) {
    return this.neighborhoodWatch.createPostReaction(postId, dto, request.user);
  }

  @Delete("posts/:postId/reactions/:type")
  @RequirePermissions("community:post")
  deleteReaction(@Param("postId") postId: string, @Param("type") type: CreateCommunityReactionDto["type"], @Req() request: any) {
    return this.neighborhoodWatch.deletePostReaction(postId, type, request.user);
  }

  @Post("communities/:communityId/reports")
  @RateLimit("communityPostCreate")
  @RequirePermissions("community:post")
  reportContent(@Param("communityId") communityId: string, @Body() dto: CreateCommunityContentReportDto, @Req() request: any) {
    return this.neighborhoodWatch.createContentReport(communityId, dto, request.user);
  }

  @Get("reports")
  @RequirePermissions("community:moderate")
  listReports(@Req() request: any, @Query("communityId") communityId?: string) {
    return this.neighborhoodWatch.listContentReports(request.user, communityId);
  }

  @Delete("posts/:postId")
  @RequirePermissions("community:moderate")
  removePost(@Param("postId") postId: string, @Body() dto: { note?: string }, @Req() request: any) {
    return this.neighborhoodWatch.removePost(postId, request.user, dto.note);
  }

  @Patch("posts/:postId/restore")
  @RequirePermissions("community:moderate")
  restorePost(@Param("postId") postId: string, @Req() request: any) {
    return this.neighborhoodWatch.restorePost(postId, request.user);
  }

  @Patch("reports/:reportId/review")
  @RequirePermissions("community:moderate")
  reviewReport(@Param("reportId") reportId: string, @Body() dto: { action: "reviewed" | "dismissed"; note?: string }, @Req() request: any) {
    return this.neighborhoodWatch.reviewContentReport(reportId, dto, request.user);
  }

  @Patch("posts/:postId/verify")
  @RequirePermissions("community:verify")
  verifyPost(@Param("postId") postId: string, @Body() dto: VerifyCommunityPostDto, @Req() request: any) {
    return this.neighborhoodWatch.verifyPost(postId, dto, request.user);
  }

  @Post("posts/:postId/convert-to-incident")
  @RequirePermissions("incident:create")
  convertPostToIncident(@Param("postId") postId: string, @Req() request: any) {
    return this.neighborhoodWatch.convertPostToIncident(postId, request.user);
  }

  @Post("posts/:postId/broadcast/:scope")
  @RequirePermissions("broadcast:create")
  broadcastPost(@Param("postId") postId: string, @Param("scope") scope: "Neighborhood" | "LGA" | "State" | "Emergency", @Req() request: any) {
    return this.neighborhoodWatch.broadcastVerifiedPost(postId, scope, request.user);
  }

  @Get("communities/:communityId/map")
  @RequirePermissions("community:read")
  map(@Param("communityId") communityId: string, @Req() request: any) {
    return this.neighborhoodWatch.map(communityId, request.user);
  }

  @Post("volunteers")
  @RequirePermissions("community:volunteer")
  registerVolunteer(@Body() dto: RegisterVolunteerDto, @Req() request: any) {
    return this.neighborhoodWatch.registerVolunteer(dto, request.user);
  }

  @Patch("volunteers/:volunteerId")
  @RequirePermissions("community:moderate")
  updateVolunteer(@Param("volunteerId") volunteerId: string, @Body() dto: UpdateVolunteerAdminDto, @Req() request: any) {
    return this.neighborhoodWatch.updateVolunteerAdmin(volunteerId, dto, request.user);
  }

  @Get("admin/memberships")
  @RequirePermissions("community:moderate")
  listAdminMemberships(@Req() request: any, @Query() query: Record<string, string | undefined>) {
    return this.neighborhoodWatch.listAdminMemberships(request.user, query);
  }

  @Post("communities/:communityId/patrols")
  @RequirePermissions("community:patrol")
  createPatrol(@Param("communityId") communityId: string, @Body() dto: CreatePatrolScheduleDto, @Req() request: any) {
    return this.neighborhoodWatch.createPatrol(communityId, dto, request.user);
  }

  @Get("communities/:communityId/patrols")
  @RequirePermissions("community:read")
  listPatrols(@Param("communityId") communityId: string, @Req() request: any) {
    return this.neighborhoodWatch.listPatrols(communityId, request.user);
  }

  @Get("patrols/:scheduleId")
  @RequirePermissions("community:read")
  getPatrol(@Param("scheduleId") scheduleId: string, @Req() request: any) {
    return this.neighborhoodWatch.getPatrolSchedule(scheduleId, request.user);
  }

  @Patch("patrols/:scheduleId")
  @RequirePermissions("community:patrol")
  updatePatrol(@Param("scheduleId") scheduleId: string, @Body() dto: UpdatePatrolScheduleDto, @Req() request: any) {
    return this.neighborhoodWatch.updatePatrolSchedule(scheduleId, dto, request.user);
  }

  @Post("patrols/:scheduleId/checkpoints")
  @RequirePermissions("community:volunteer")
  logCheckpoint(@Param("scheduleId") scheduleId: string, @Body() dto: PatrolCheckpointDto, @Req() request: any) {
    return this.neighborhoodWatch.logCheckpoint(scheduleId, dto, request.user);
  }

  @Post("patrols/:scheduleId/join")
  @RequirePermissions("community:volunteer")
  joinPatrol(@Param("scheduleId") scheduleId: string, @Req() request: any) {
    return this.neighborhoodWatch.joinPatrol(scheduleId, request.user);
  }

  @Post("patrols/:scheduleId/observations")
  @RequirePermissions("community:volunteer")
  createPatrolObservation(
    @Param("scheduleId") scheduleId: string,
    @Body() dto: CreatePatrolObservationDto,
    @Req() request: any,
  ) {
    return this.neighborhoodWatch.createPatrolObservation(scheduleId, dto, request.user);
  }

  @Post("patrols/:scheduleId/start")
  @RequirePermissions("community:volunteer")
  startPatrol(@Param("scheduleId") scheduleId: string, @Req() request: any) {
    return this.neighborhoodWatch.transitionPatrol(scheduleId, "Active", request.user);
  }

  @Post("patrols/:scheduleId/pause")
  @RequirePermissions("community:volunteer")
  pausePatrol(@Param("scheduleId") scheduleId: string, @Req() request: any) {
    return this.neighborhoodWatch.transitionPatrol(scheduleId, "Paused", request.user);
  }

  @Post("patrols/:scheduleId/complete")
  @RequirePermissions("community:volunteer")
  completePatrol(@Param("scheduleId") scheduleId: string, @Req() request: any) {
    return this.neighborhoodWatch.transitionPatrol(scheduleId, "Completed", request.user);
  }

  @Post("patrols/:scheduleId/cancel")
  @RequirePermissions("community:volunteer")
  cancelPatrol(@Param("scheduleId") scheduleId: string, @Req() request: any) {
    return this.neighborhoodWatch.transitionPatrol(scheduleId, "Cancelled", request.user);
  }

  @Get("communities/:communityId/official-alerts")
  @RequirePermissions("community:read")
  listOfficialAlerts(@Param("communityId") communityId: string, @Req() request: any) {
    return this.neighborhoodWatch.listCommunityAlerts(communityId, request.user);
  }

  @Post("communities/:communityId/official-alerts")
  @RequirePermissions("community:moderate")
  createOfficialAlert(
    @Param("communityId") communityId: string,
    @Body() dto: CreateCommunityAlertDto,
    @Req() request: any,
  ) {
    return this.neighborhoodWatch.createCommunityAlert(communityId, dto, request.user);
  }

  @Patch("communities/:communityId/official-alerts/:alertId")
  @RequirePermissions("community:moderate")
  updateOfficialAlert(
    @Param("communityId") communityId: string,
    @Param("alertId") alertId: string,
    @Body() dto: UpdateCommunityAlertDto,
    @Req() request: any,
  ) {
    return this.neighborhoodWatch.updateCommunityAlert(communityId, alertId, dto, request.user);
  }

  @Post("communities/:communityId/official-alerts/:alertId/cancel")
  @RequirePermissions("community:moderate")
  cancelOfficialAlert(
    @Param("communityId") communityId: string,
    @Param("alertId") alertId: string,
    @Req() request: any,
  ) {
    return this.neighborhoodWatch.cancelCommunityAlert(communityId, alertId, request.user);
  }

  @Get("communities/:communityId/pinned-safety")
  @RequirePermissions("community:read")
  listPinnedSafety(@Param("communityId") communityId: string, @Req() request: any) {
    return this.neighborhoodWatch.listPinnedSafetyInfo(communityId, request.user);
  }

  @Post("communities/:communityId/pinned-safety")
  @RequirePermissions("community:moderate")
  createPinnedSafety(
    @Param("communityId") communityId: string,
    @Body() dto: CreatePinnedSafetyInfoDto,
    @Req() request: any,
  ) {
    return this.neighborhoodWatch.createPinnedSafetyInfo(communityId, dto, request.user);
  }

  @Patch("communities/:communityId/pinned-safety/:pinnedId")
  @RequirePermissions("community:moderate")
  updatePinnedSafety(
    @Param("communityId") communityId: string,
    @Param("pinnedId") pinnedId: string,
    @Body() dto: UpdatePinnedSafetyInfoDto,
    @Req() request: any,
  ) {
    return this.neighborhoodWatch.updatePinnedSafetyInfo(communityId, pinnedId, dto, request.user);
  }

  @Post("communities/:communityId/pinned-safety/:pinnedId/deactivate")
  @RequirePermissions("community:moderate")
  deactivatePinnedSafety(
    @Param("communityId") communityId: string,
    @Param("pinnedId") pinnedId: string,
    @Req() request: any,
  ) {
    return this.neighborhoodWatch.deactivatePinnedSafetyInfo(communityId, pinnedId, request.user);
  }

  @Get("channels/:channelId/messages")
  @RequirePermissions("community:read")
  channelMessages(@Param("channelId") channelId: string, @Req() request: any) {
    return this.neighborhoodWatch.channelMessages(channelId, request.user);
  }

  @Post("channels/:channelId/messages")
  @RequirePermissions("community:post")
  sendMessage(@Param("channelId") channelId: string, @Body() dto: SendCommunityMessageDto, @Req() request: any) {
    return this.neighborhoodWatch.sendMessage(channelId, dto, request.user);
  }

  @Get("admin/ai-intelligence")
  @RequirePermissions("community:read")
  aiIntelligence(@Req() request: any, @Query() query: Record<string, string | undefined>) {
    return this.aiIntelligenceService.getDashboard(request.user, {
      windowDays: query.windowDays ? Number(query.windowDays) : undefined,
      communityId: query.communityId,
    });
  }
}
