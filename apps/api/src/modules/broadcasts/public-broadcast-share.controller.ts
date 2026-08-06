import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { BroadcastShareService } from "./broadcast-share.service";

@ApiTags("public-broadcasts")
@Controller("public/broadcasts")
export class PublicBroadcastShareController {
  constructor(private readonly share: BroadcastShareService) {}

  @Get(":id")
  getShare(@Param("id") id: string) {
    return this.share.getPublicShare(id);
  }
}
