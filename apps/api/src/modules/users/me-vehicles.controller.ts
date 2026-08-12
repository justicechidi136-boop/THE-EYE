import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import {
  CreateCitizenVehicleDto,
  SetPrimaryCitizenVehicleDto,
  UpdateCitizenVehicleDto,
} from "./dto/users.dto";
import { UsersService } from "./users.service";

@ApiTags("me-vehicles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("me/vehicles")
@RateLimit("auth")
export class MeVehiclesController {
  constructor(private readonly users: UsersService) {}

  @Get()
  listMyVehicles(
    @Req() request: { user: Parameters<UsersService["listMyVehicles"]>[0] },
  ) {
    return this.users.listMyVehicles(request.user);
  }

  @Post()
  createMyVehicle(
    @Req() request: { user: Parameters<UsersService["createMyVehicle"]>[0] },
    @Body() dto: CreateCitizenVehicleDto,
  ) {
    return this.users.createMyVehicle(request.user, dto);
  }

  @Get(":id")
  getMyVehicle(
    @Req() request: { user: Parameters<UsersService["getMyVehicle"]>[0] },
    @Param("id") id: string,
  ) {
    return this.users.getMyVehicle(request.user, id);
  }

  @Patch(":id")
  updateMyVehicle(
    @Req() request: { user: Parameters<UsersService["updateMyVehicle"]>[0] },
    @Param("id") id: string,
    @Body() dto: UpdateCitizenVehicleDto,
  ) {
    return this.users.updateMyVehicle(request.user, id, dto);
  }

  @Delete(":id")
  deleteMyVehicle(
    @Req() request: { user: Parameters<UsersService["deleteMyVehicle"]>[0] },
    @Param("id") id: string,
  ) {
    return this.users.deleteMyVehicle(request.user, id);
  }

  @Post(":id/primary")
  setMyVehiclePrimary(
    @Req() request: { user: Parameters<UsersService["setMyVehiclePrimary"]>[0] },
    @Param("id") id: string,
    @Body() dto: SetPrimaryCitizenVehicleDto,
  ) {
    return this.users.setMyVehiclePrimary(request.user, id, dto.isPrimary);
  }
}
