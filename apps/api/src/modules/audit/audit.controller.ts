import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { AuditService } from "./audit.service";

@ApiTags("audit")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions("audit:read")
  list(
    @Req() request: any,
    @Query("action") action?: string,
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.audit.list(request.user, { action, entityType, entityId }, { cursor, limit });
  }

  @Get("verify-chain")
  @RequirePermissions("audit:read")
  verifyChain() {
    return this.audit.verifyChain();
  }
}
