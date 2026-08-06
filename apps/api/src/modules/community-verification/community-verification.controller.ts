import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import { CommunityVerificationRespondDto, CommunityVerificationSkipDto } from "./dto/community-verification.dto";
import { CommunityVerificationService } from "./community-verification.service";

@ApiTags("community-verifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("community-verifications")
export class CommunityVerificationController {
  constructor(private readonly service: CommunityVerificationService) {}

  @Get("pending")
  listPending(@Req() request: { user: { sub: string; typ: string } }) {
    if (request.user.typ !== "user") return { data: [] };
    return this.service.listPending(request.user as never);
  }

  @Get(":requestId")
  getSafePayload(@Param("requestId") requestId: string, @Req() request: { user: { sub: string; typ: string } }) {
    return this.service.getSafePayload(requestId, request.user as never);
  }

  @Post(":requestId/opened")
  @RateLimit("communityVerificationRespond")
  markOpened(@Param("requestId") requestId: string, @Req() request: { user: { sub: string } }) {
    return this.service.markOpened(requestId, request.user as never);
  }

  @Post(":requestId/respond")
  @RateLimit("communityVerificationRespond")
  respond(
    @Param("requestId") requestId: string,
    @Body() dto: CommunityVerificationRespondDto,
    @Req() request: { user: { sub: string } },
  ) {
    return this.service.respond(requestId, dto, request.user as never);
  }

  @Post(":requestId/skip")
  @RateLimit("communityVerificationRespond")
  skip(
    @Param("requestId") requestId: string,
    @Body() dto: CommunityVerificationSkipDto,
    @Req() request: { user: { sub: string } },
  ) {
    return this.service.skip(requestId, dto, request.user as never);
  }
}
