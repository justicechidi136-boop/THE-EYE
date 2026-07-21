import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import {
  AvatarConfirmDto,
  AvatarPresignDto,
  RequestAccountDeletionDto,
  ReviewKycDto,
  SubmitKycDto,
  UpdateCitizenProfileDto,
  UpsertEmergencyContactDto,
} from "./dto/users.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("users")
@RateLimit("auth")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  me(@Req() request: { user: Parameters<UsersService["getMe"]>[0] }) {
    return this.users.getMe(request.user);
  }

  @Patch("me")
  updateMe(
    @Req() request: { user: Parameters<UsersService["updateMe"]>[0] },
    @Body() dto: UpdateCitizenProfileDto,
  ) {
    return this.users.updateMe(request.user, dto);
  }

  @Get("me/emergency-contacts")
  listEmergencyContacts(
    @Req() request: { user: Parameters<UsersService["listEmergencyContacts"]>[0] },
  ) {
    return this.users.listEmergencyContacts(request.user);
  }

  @Post("me/emergency-contacts")
  createEmergencyContact(
    @Req() request: { user: Parameters<UsersService["createEmergencyContact"]>[0] },
    @Body() dto: UpsertEmergencyContactDto,
  ) {
    return this.users.createEmergencyContact(request.user, dto);
  }

  @Patch("me/emergency-contacts/:id")
  updateEmergencyContact(
    @Req() request: { user: Parameters<UsersService["updateEmergencyContact"]>[0] },
    @Param("id") id: string,
    @Body() dto: UpsertEmergencyContactDto,
  ) {
    return this.users.updateEmergencyContact(request.user, id, dto);
  }

  @Delete("me/emergency-contacts/:id")
  deleteEmergencyContact(
    @Req() request: { user: Parameters<UsersService["deleteEmergencyContact"]>[0] },
    @Param("id") id: string,
  ) {
    return this.users.deleteEmergencyContact(request.user, id);
  }

  @Post("me/avatar/presign")
  presignAvatar(
    @Req() request: { user: Parameters<UsersService["presignAvatar"]>[0] },
    @Body() dto: AvatarPresignDto,
  ) {
    return this.users.presignAvatar(request.user, dto);
  }

  @Post("me/avatar/confirm")
  confirmAvatar(
    @Req() request: { user: Parameters<UsersService["confirmAvatar"]>[0] },
    @Body() dto: AvatarConfirmDto,
  ) {
    return this.users.confirmAvatar(request.user, dto);
  }

  @Post("me/kyc")
  submitKyc(
    @Req() request: { user: Parameters<UsersService["submitKyc"]>[0] },
    @Body() dto: SubmitKycDto,
  ) {
    return this.users.submitKyc(request.user, dto);
  }

  @Post("me/deletion-request")
  requestDeletion(
    @Req() request: { user: Parameters<UsersService["requestAccountDeletion"]>[0] },
    @Body() dto: RequestAccountDeletionDto,
  ) {
    return this.users.requestAccountDeletion(request.user, dto.confirm);
  }

  @Get("directory")
  @RequirePermissions("user:manage")
  directory(
    @Req() request: { user: Parameters<UsersService["listDirectory"]>[0] },
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.users.listDirectory(request.user, { cursor, limit });
  }

  @Get("kyc/pending")
  @RequirePermissions("user:manage")
  pendingKyc(
    @Req() request: { user: Parameters<UsersService["listPendingKyc"]>[0] },
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.users.listPendingKyc(request.user, { cursor, limit });
  }

  @Patch("kyc/:id/review")
  @RequirePermissions("user:manage")
  reviewKyc(
    @Req() request: { user: Parameters<UsersService["reviewKyc"]>[0] },
    @Param("id") id: string,
    @Body() dto: ReviewKycDto,
  ) {
    return this.users.reviewKyc(request.user, id, dto);
  }

  @Get(":id")
  @RequirePermissions("user:manage")
  citizenDetail(
    @Req() request: { user: Parameters<UsersService["getCitizenDetail"]>[0] },
    @Param("id") id: string,
  ) {
    return this.users.getCitizenDetail(request.user, id);
  }
}
