import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  me(@Req() request: { user: unknown }) {
    return request.user;
  }

  @Get("directory")
  @RequirePermissions("user:manage")
  directory(@Req() request: { user: Parameters<UsersService["listDirectory"]>[0] }, @Query("cursor") cursor?: string, @Query("limit") limit?: string) {
    return this.users.listDirectory(request.user, { cursor, limit });
  }
}
