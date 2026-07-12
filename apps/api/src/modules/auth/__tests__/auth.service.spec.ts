import { BadRequestException, HttpException } from "@nestjs/common";
import { hashOtp } from "../../../common/auth/crypto";
import { AuthService } from "../auth.service";

function createAuthService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    phoneOtp: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: "otp-1" }),
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ id: "user-1", email: null, phone: "+2348012345678", trustedReporter: null }),
    },
    refreshToken: { create: jest.fn().mockResolvedValue({}) },
    ...overrides,
  };

  const config = {
    get: (key: string, fallback?: string) => {
      if (key === "JWT_ACCESS_TTL") return "15m";
      if (key === "JWT_REFRESH_TTL") return "30d";
      if (key === "JWT_ACCESS_SECRET") return "test-access-secret-32-characters-min";
      if (key === "JWT_REFRESH_SECRET") return "test-refresh-secret-32-characters-min";
      return fallback;
    },
  };

  return {
    service: new AuthService(prisma as never, config as never, { record: jest.fn() } as never, { verify: jest.fn() } as never),
    prisma,
  };
}

describe("AuthService phone OTP", () => {
  it("rate limits OTP resend requests", async () => {
    const { service, prisma } = createAuthService();
    prisma.phoneOtp.count.mockResolvedValue(3);

    try {
      await service.requestPhoneOtp("+2348012345678", "login");
      throw new Error("Expected rate limit");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
    }
  });

  it("rejects expired OTP codes", async () => {
    const phone = "+2348012345678";
    const { service, prisma } = createAuthService();
    prisma.phoneOtp.findFirst.mockResolvedValue({
      id: "otp-expired",
      phone,
      purpose: "login",
      attempts: 0,
      verifiedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
      codeHash: hashOtp(phone, "123456", "login"),
    });

    try {
      await service.verifyPhoneOtp(phone, "123456", "login");
      throw new Error("Expected expired OTP failure");
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect(String((error as BadRequestException).message)).toContain("OTP expired");
    }
  });

  it("rejects already-used OTP codes", async () => {
    const phone = "+2348012345678";
    const { service, prisma } = createAuthService();
    prisma.phoneOtp.findFirst.mockResolvedValue({
      id: "otp-used",
      phone,
      purpose: "login",
      attempts: 0,
      verifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      codeHash: hashOtp(phone, "123456", "login"),
    });

    try {
      await service.verifyPhoneOtp(phone, "123456", "login");
      throw new Error("Expected used OTP failure");
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect(String((error as BadRequestException).message)).toContain("already been used");
    }
  });

  it("rejects locked OTP codes after too many attempts", async () => {
    const phone = "+2348012345678";
    const { service, prisma } = createAuthService();
    prisma.phoneOtp.findFirst.mockResolvedValue({
      id: "otp-locked",
      phone,
      purpose: "login",
      attempts: 5,
      verifiedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      codeHash: hashOtp(phone, "123456", "login"),
    });

    try {
      await service.verifyPhoneOtp(phone, "123456", "login");
      throw new Error("Expected locked OTP failure");
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect(String((error as BadRequestException).message)).toContain("locked");
    }
  });

  it("rejects invalid OTP codes without revealing secrets", async () => {
    const phone = "+2348012345678";
    const { service, prisma } = createAuthService();
    prisma.phoneOtp.findFirst.mockResolvedValue({
      id: "otp-active",
      phone,
      purpose: "login",
      attempts: 1,
      verifiedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      codeHash: hashOtp(phone, "123456", "login"),
    });

    try {
      await service.verifyPhoneOtp(phone, "000000", "login");
      throw new Error("Expected invalid OTP failure");
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect(String((error as BadRequestException).message)).toContain("Invalid OTP code");
      expect(prisma.phoneOtp.update).toHaveBeenCalled();
    }
  });
});
