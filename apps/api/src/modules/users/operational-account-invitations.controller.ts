import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import { AcceptOperationalAdminInvitationDto } from "./dto/users.dto";
import { UsersService } from "./users.service";

@ApiTags("operational-account-invitations")
@Controller("auth/admin-invitations")
@RateLimit("auth")
export class OperationalAccountInvitationsController {
  constructor(private readonly users: UsersService) {}

  @Post("accept")
  accept(@Body() dto: AcceptOperationalAdminInvitationDto) {
    return this.users.acceptOperationalAdminInvitation(dto);
  }
}
