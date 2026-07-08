import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CreateEscalationRuleDto, RunEscalationCheckDto, UpdateEscalationRuleDto } from "./dto/escalation-rule.dto";
import { EscalationService } from "./escalation.service";

@ApiTags("escalation")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("escalation")
export class EscalationController {
  constructor(private readonly escalationService: EscalationService) {}

  @Post("rules")
  @RequirePermissions("incident:escalate")
  createRule(@Body() dto: CreateEscalationRuleDto, @Req() request: any) {
    return this.escalationService.createRule(dto, request.user);
  }

  @Get("rules")
  @RequirePermissions("incident:escalate")
  listRules() {
    return this.escalationService.listRules();
  }

  @Patch("rules/:id")
  @RequirePermissions("incident:escalate")
  updateRule(@Param("id") id: string, @Body() dto: UpdateEscalationRuleDto, @Req() request: any) {
    return this.escalationService.updateRule(id, dto, request.user);
  }

  @Post("run")
  @RequirePermissions("incident:escalate")
  run(@Body() dto: RunEscalationCheckDto, @Req() request: any) {
    return this.escalationService.runEscalationCheck(dto, request.user);
  }

  @Post(":id/acknowledge")
  @RequirePermissions("incident:update")
  acknowledge(@Param("id") id: string, @Req() request: any) {
    return this.escalationService.acknowledgeEscalation(id, request.user);
  }
}
