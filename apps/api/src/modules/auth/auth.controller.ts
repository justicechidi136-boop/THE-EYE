import { Body, Controller, Delete, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import {
  FirebaseExchangeDto,
  FirebaseLinkDto,
  GoogleLoginDto,
  LoginDto,
  AccountRecoveryCompleteDto,
  AccountRecoveryRequestDto,
  AccountRecoveryVerifyDto,
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
  PhoneOtpRequestDto,
  PhoneOtpVerifyDto,
  RefreshDto,
  RegisterDto,
} from "./dto/auth.dto";
import { AuthService } from "./auth.service";
import { AccountRecoveryService } from "./account-recovery.service";

@ApiTags("auth")
@Controller("auth")
@RateLimit("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(AccountRecoveryService) private readonly accountRecovery: AccountRecoveryService,
  ) {}

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("google")
  google(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto);
  }

  @Post("firebase/exchange")
  exchangeFirebase(@Body() dto: FirebaseExchangeDto) {
    return this.authService.exchangeFirebaseToken(dto);
  }

  @Post("providers/link")
  @UseGuards(JwtAuthGuard)
  linkProvider(@Req() request: { user: { sub: string } }, @Body() dto: FirebaseLinkDto) {
    return this.authService.linkProvider(request.user.sub, dto);
  }

  @Delete("providers/:provider")
  @UseGuards(JwtAuthGuard)
  unlinkProvider(@Req() request: { user: { sub: string } }, @Param("provider") provider: string) {
    return this.authService.unlinkProvider(request.user.sub, provider);
  }

  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post("logout")
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post("password-reset/request")
  requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post("password-reset/confirm")
  confirmPasswordReset(@Body() dto: PasswordResetConfirmDto) {
    return this.authService.confirmPasswordReset(dto.token, dto.newPassword);
  }

  @Post("account-recovery/request")
  requestAccountRecovery(@Body() dto: AccountRecoveryRequestDto) {
    return this.accountRecovery.requestRecovery(dto.email, {
      platform: dto.platform,
      deviceId: dto.deviceId,
    });
  }

  @Post("account-recovery/verify")
  verifyAccountRecovery(@Body() dto: AccountRecoveryVerifyDto) {
    return this.accountRecovery.verifyRecoveryToken(dto.token);
  }

  @Post("account-recovery/complete")
  async completeAccountRecovery(@Body() dto: AccountRecoveryCompleteDto) {
    const recovery = await this.accountRecovery.completeRecovery(dto.token, dto.idToken, dto.provider);
    const session = await this.authService.issueRecoverySession(recovery.userId);
    return { ...session, recoveryCompleted: true };
  }

  @Post("account-recovery/cancel")
  cancelAccountRecovery(@Body() dto: AccountRecoveryVerifyDto) {
    return this.accountRecovery.cancelRecovery(dto.token);
  }

  @Post("phone/request-otp")
  requestPhoneOtp(@Body() dto: PhoneOtpRequestDto) {
    return this.authService.requestPhoneOtp(dto.phone, dto.purpose ?? "login");
  }

  @Post("phone/verify-otp")
  verifyPhoneOtp(@Body() dto: PhoneOtpVerifyDto) {
    return this.authService.verifyPhoneOtp(dto.phone, dto.code, dto.purpose ?? "login");
  }
}
