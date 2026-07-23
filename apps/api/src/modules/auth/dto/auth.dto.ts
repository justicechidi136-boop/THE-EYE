import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "citizen@theeye.local" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Password123!" })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: "Ada" })
  @IsString()
  @MinLength(1)
  firstName!: string;

  @ApiProperty({ example: "Okeke" })
  @IsString()
  @MinLength(1)
  lastName!: string;
}

export class LoginDto {
  @ApiPropertyOptional({ example: "dispatcher.ikeja@theeye.local" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: "+2348000002001" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: "Password123!" })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  admin?: boolean;
}

export class GoogleLoginDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  googleId?: string;

  @ApiProperty({ example: "citizen@theeye.local" })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  refreshToken!: string;
}

export class PasswordResetRequestDto {
  @ApiProperty({ example: "citizen@theeye.local" })
  @IsEmail()
  email!: string;
}

export class PasswordResetConfirmDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  token!: string;

  @ApiProperty({ example: "Password123!" })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class PhoneOtpRequestDto {
  @ApiProperty({ example: "+2348000002001" })
  @IsString()
  phone!: string;

  @ApiPropertyOptional({ default: "login" })
  @IsOptional()
  @IsString()
  purpose?: string;
}

export class PhoneOtpVerifyDto {
  @ApiProperty({ example: "+2348000002001" })
  @IsString()
  phone!: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @MinLength(4)
  code!: string;

  @ApiPropertyOptional({ default: "login" })
  @IsOptional()
  @IsString()
  purpose?: string;
}

const FIREBASE_PROVIDERS = ["google.com", "apple.com"] as const;
export type FirebaseProvider = (typeof FIREBASE_PROVIDERS)[number];

export class FirebaseExchangeDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  idToken!: string;

  @ApiProperty({ enum: FIREBASE_PROVIDERS })
  @IsString()
  provider!: FirebaseProvider;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ enum: ["android", "ios"] })
  @IsOptional()
  @IsString()
  platform?: "android" | "ios";
}

export class FirebaseLinkDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  idToken!: string;

  @ApiProperty({ enum: FIREBASE_PROVIDERS })
  @IsString()
  provider!: FirebaseProvider;
}

export class AccountRecoveryRequestDto {
  @ApiProperty({ example: "citizen@theeye.local" })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ enum: ["android", "ios", "web"] })
  @IsOptional()
  @IsString()
  platform?: "android" | "ios" | "web";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class AccountRecoveryVerifyDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  token!: string;
}

export class AccountRecoveryCompleteDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  token!: string;

  @ApiProperty()
  @IsString()
  @MinLength(20)
  idToken!: string;

  @ApiProperty({ enum: FIREBASE_PROVIDERS })
  @IsString()
  provider!: FirebaseProvider;
}
