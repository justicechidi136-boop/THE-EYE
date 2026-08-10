import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import { RateLimitGuard } from "../../common/rate-limit/rate-limit.guard";
import { FieldDevicePairingService } from "./field-device-pairing.service";
import type {
  ClaimFieldPairingDto,
  CompleteFieldPairingClaimDto,
  FieldPairingChallengeDto,
  FieldPairingStatusQuery,
} from "./dto/field-device-pairing.dto";

/**
 * Field-side (device) pairing endpoints. Unauthenticated by design — the device has
 * no session yet — so every action is scoped to a single hashed, single-use, rate
 * limited pairing token/short-code rather than a bearer token.
 */
@ApiTags("field-pairing")
@Controller("field/pairing")
@UseGuards(RateLimitGuard)
export class FieldPairingController {
  constructor(private readonly pairing: FieldDevicePairingService) {}

  @Post("claim")
  @RateLimit("fieldPairing")
  claim(@Body() dto: ClaimFieldPairingDto) {
    return this.pairing.claim(dto);
  }

  @Post("challenge")
  @RateLimit("fieldPairing")
  challenge(@Body() dto: FieldPairingChallengeDto) {
    return this.pairing.challenge(dto);
  }

  @Post("complete")
  @RateLimit("fieldPairing")
  complete(@Body() dto: CompleteFieldPairingClaimDto) {
    return this.pairing.complete(dto);
  }

  @Get("status")
  @RateLimit("fieldPairing")
  status(@Query() query: FieldPairingStatusQuery) {
    return this.pairing.status(query);
  }
}
