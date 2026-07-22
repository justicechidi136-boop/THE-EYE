import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import {
  AssignCommunityRoleDto,
  CreateCommunityCommentDto,
  CreateCommunityContentReportDto,
  CreateCommunityDto,
  CreateCommunityPostDto,
  CreateCommunityReactionDto,
  CreateCommunityRequestDto,
  CreatePatrolScheduleDto,
  PatrolCheckpointDto,
  RegisterVolunteerDto,
  ReviewCommunityRequestDto,
  SendCommunityMessageDto,
  UpdateCommunityCommentDto,
  VerifyCommunityPostDto,
} from "./dto/neighborhood-watch.dto";
import { NeighborhoodWatchService } from "./neighborhood-watch.service";

@ApiTags("neighborhood-watch")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("neighborhood-watch")
export class NeighborhoodWatchController {
  constructor(private readonly neighborhoodWatch: NeighborhoodWatchService) {}

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

  @Get("communities/:communityId/members")
  @RequirePermissions("community:read")
  listMembers(@Param("communityId") communityId: string, @Req() request: any, @Query("cursor") cursor?: string, @Query("limit") limit?: string) {
    return this.neighborhoodWatch.listMembers(communityId, request.user, { cursor, limit });
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

  @Post("communities/:communityId/posts")
  @RateLimit("communityPostCreate")
  @RequirePermissions("community:post")
  createPost(@Param("communityId") communityId: string, @Body() dto: CreateCommunityPostDto, @Req() request: any) {
    return this.neighborhoodWatch.createPost(communityId, dto, request.user);
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

  @Post("patrols/:scheduleId/checkpoints")
  @RequirePermissions("community:volunteer")
  logCheckpoint(@Param("scheduleId") scheduleId: string, @Body() dto: PatrolCheckpointDto, @Req() request: any) {
    return this.neighborhoodWatch.logCheckpoint(scheduleId, dto, request.user);
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
}
