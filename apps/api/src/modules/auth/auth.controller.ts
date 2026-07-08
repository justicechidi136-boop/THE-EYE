import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";

class LoginDto {
  email?: string;
  phone?: string;
  password!: string;
  admin?: boolean;
}

class GoogleLoginDto {
  idToken?: string;
  googleId?: string;
  email!: string;
  firstName?: string;
  lastName?: string;
}

class RefreshDto {
  refreshToken!: string;
}

class PasswordResetRequestDto {
  email!: string;
}

class PasswordResetConfirmDto {
  token!: string;
  newPassword!: string;
}

class PhoneOtpRequestDto {
  phone!: string;
  purpose?: string;
}

class PhoneOtpVerifyDto {
  phone!: string;
  code!: string;
  purpose?: string;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("google")
  google(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto);
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

  @Post("phone/request-otp")
  requestPhoneOtp(@Body() dto: PhoneOtpRequestDto) {
    return this.authService.requestPhoneOtp(dto.phone, dto.purpose ?? "login");
  }

  @Post("phone/verify-otp")
  verifyPhoneOtp(@Body() dto: PhoneOtpVerifyDto) {
    return this.authService.verifyPhoneOtp(dto.phone, dto.code, dto.purpose ?? "login");
  }
}
