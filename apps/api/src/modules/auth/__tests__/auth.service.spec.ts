import { BadRequestException, ConflictException, ForbiddenException, HttpException, UnauthorizedException } from "@nestjs/common";
import { hashOtp, hashPassword, hashToken } from "../../../common/auth/crypto";
import { signJwt, verifyJwt } from "../../../common/auth/jwt";
import { AuthService } from "../auth.service";

function createAuthService(overrides: Record<string, unknown> = {}) {
  const authDelivery = {
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendPhoneOtp: jest.fn().mockResolvedValue(undefined),
    allowDevAuthCodes: jest.fn().mockReturnValue(true),
  };

  const prisma = {
    phoneOtp: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: "otp-1" }),
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn(),
      upsert: jest.fn().mockResolvedValue({ id: "user-1", email: null, phone: "+2348012345678", trustedReporter: null }),
      create: jest.fn(),
    },
    refreshToken: { create: jest.fn().mockResolvedValue({}) },
    passwordResetToken: {
      create: jest.fn().mockResolvedValue({ id: "reset-1" }),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
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
    service: new AuthService(
      prisma as never,
      config as never,
      { record: jest.fn() } as never,
      { verify: jest.fn() } as never,
      authDelivery as never,
    ),
    prisma,
    authDelivery,
  };
}

describe("AuthService registration", () => {
  it("creates a citizen account and returns a session", async () => {
    const createdUser = {
      id: "user-new",
      email: "new@theeye.local",
      phone: null,
      trustedReporter: null,
      profile: { firstName: "Ada", lastName: "Okeke", country: "", state: "", lga: "" },
    };
    const { service, prisma } = createAuthService({
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createdUser),
      },
    });

    const result = await service.register({
      email: "new@theeye.local",
      password: "Password123!",
      firstName: "Ada",
      lastName: "Okeke",
    });

    expect(prisma.user.create).toHaveBeenCalled();
    expect(result.accessToken.length).toBeGreaterThan(0);
    expect(result.refreshToken.length).toBeGreaterThan(0);
    expect(result.profileComplete).toBe(false);
  });

  it("rejects registration without names", async () => {
    const { service, prisma } = createAuthService();

    await expect(
      service.register({ email: "new@theeye.local", password: "Password123!" } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects duplicate email registration", async () => {
    const { service, prisma } = createAuthService({
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: "existing-user", email: "taken@theeye.local" }),
        create: jest.fn(),
      },
    });

    await expect(
      service.register({
        email: "taken@theeye.local",
        password: "Password123!",
        firstName: "Ada",
        lastName: "Okeke",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

describe("AuthService delivery", () => {
  it("dispatches password reset through delivery service", async () => {
    const { service, authDelivery } = createAuthService({
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: "user-1", email: "citizen@theeye.local" }),
      },
    });

    await service.requestPasswordReset("citizen@theeye.local");

    expect(authDelivery.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const [email, token] = authDelivery.sendPasswordResetEmail.mock.calls[0] as [
      string,
      string,
    ];
    expect(email).toBe("citizen@theeye.local");
    expect(token.length).toBeGreaterThan(10);
  });

  it("dispatches phone OTP through delivery service", async () => {
    const { service, authDelivery } = createAuthService();

    await service.requestPhoneOtp("+2348012345678", "login");

    expect(authDelivery.sendPhoneOtp).toHaveBeenCalledTimes(1);
    const args = authDelivery.sendPhoneOtp.mock.calls[0] as unknown[];
    expect(args[0]).toBe("+2348012345678");
    expect(args[2]).toBe("login");
    expect(typeof args[1]).toBe("string");
  });
});

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

describe("AuthService login", () => {
  it("accepts case-insensitive email lookup for citizens", async () => {
    const password = "Password123!";
    const { service, prisma } = createAuthService({
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: "user-1",
          email: "staging.citizen@theeye.local",
          phone: null,
          passwordHash: hashPassword(password),
          status: "Active",
          trustedReporter: null,
        }),
      },
    });

    const result = await service.login({
      email: "  Staging.Citizen@theeye.local ",
      password,
    });

    expect(result.accessToken.length).toBeGreaterThan(0);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              email: { equals: "staging.citizen@theeye.local", mode: "insensitive" },
            }),
          ]),
        }),
      }),
    );
  });

  it("issues a bounded persistent renewable session when requested", async () => {
    const password = "Password123!";
    const { service } = createAuthService({
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: "user-1",
          email: "citizen@theeye.local",
          phone: null,
          passwordHash: hashPassword(password),
          status: "Active",
          trustedReporter: null,
        }),
      },
    });

    const result = await service.login({
      email: "citizen@theeye.local",
      password,
      remainSignedIn: true,
    });
    const refresh = verifyJwt(
      result.refreshToken,
      "test-refresh-secret-32-characters-min",
    );

    expect(refresh.authMode).toBe("persistent");
    expect(refresh.exp - refresh.iat).toBe(365 * 24 * 60 * 60);
  });

  it("rejects invalid credentials without revealing account existence", async () => {
    const { service } = createAuthService({
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    });

    await expect(
      service.login({ email: "missing@theeye.local", password: "Password123!" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("blocks suspended citizens from signing in", async () => {
    const password = "Password123!";
    const { service } = createAuthService({
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: "user-1",
          email: "staging.citizen@theeye.local",
          phone: null,
          passwordHash: hashPassword(password),
          status: "Suspended",
          trustedReporter: null,
        }),
      },
    });

    await expect(
      service.login({ email: "staging.citizen@theeye.local", password }),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it("returns the stable deactivated-account contract after valid credentials", async () => {
    const password = "Password123!";
    const { service } = createAuthService({
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: "user-1",
          email: "staging.citizen@theeye.local",
          phone: null,
          passwordHash: hashPassword(password),
          status: "Deactivated",
          trustedReporter: null,
        }),
      },
    });

    try {
      await service.login({
        email: "staging.citizen@theeye.local",
        password,
      });
      throw new Error("Expected deactivated account login to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(403);
      expect((error as HttpException).getResponse()).toEqual({
        message: "Your THE EYE account is deactivated.",
        code: "ACCOUNT_DEACTIVATED",
      });
    }
  });
});

describe("AuthService refresh rotation", () => {
  const refreshSecret = "test-refresh-secret-32-characters-min";
  const accessSecret = "test-access-secret-32-characters-min";

  function refreshToken() {
    return signJwt({ sub: "user-1", typ: "user", jti: "refresh-1" }, refreshSecret, "1h");
  }

  function activeUser(status = "Active") {
    return {
      id: "user-1",
      email: "citizen@theeye.local",
      phone: null,
      status,
      trustedReporter: null,
      profile: null,
    };
  }

  it("rotates a valid refresh token in the same family", async () => {
    const token = refreshToken();
    const refreshTokenStore = {
      findUnique: jest.fn().mockResolvedValue({
        id: "stored-1",
        userId: "user-1",
        adminUserId: null,
        familyId: "family-1",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({}),
    };
    const { service } = createAuthService({
      refreshToken: refreshTokenStore,
      user: {
        findUnique: jest.fn().mockResolvedValue(activeUser()),
      },
    });

    const session = await service.refresh(token);

    expect(session.accessToken.length).toBeGreaterThan(0);
    expect(session.refreshToken.length).toBeGreaterThan(0);
    const revokeArgs = refreshTokenStore.update.mock.calls[0][0];
    expect(revokeArgs.where.id).toBe("stored-1");
    expect(revokeArgs.data.revokedAt).toBeInstanceOf(Date);
    const createArgs = refreshTokenStore.create.mock.calls[0][0];
    expect(createArgs.data.familyId).toBe("family-1");
    expect(createArgs.data.userId).toBe("user-1");
  });

  it("preserves the persistent renewable-session policy during rotation", async () => {
    const token = signJwt(
      {
        sub: "user-1",
        typ: "user",
        jti: "persistent-refresh-1",
        authMode: "persistent",
      },
      refreshSecret,
      "1h",
    );
    const refreshTokenStore = {
      findUnique: jest.fn().mockResolvedValue({
        id: "stored-persistent-1",
        userId: "user-1",
        adminUserId: null,
        familyId: "family-persistent-1",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({}),
    };
    const { service } = createAuthService({
      refreshToken: refreshTokenStore,
      user: { findUnique: jest.fn().mockResolvedValue(activeUser()) },
    });

    const session = await service.refresh(token);
    const refreshed = verifyJwt(session.refreshToken, refreshSecret);

    expect(refreshed.authMode).toBe("persistent");
    expect(refreshed.exp - refreshed.iat).toBe(365 * 24 * 60 * 60);
    expect(refreshTokenStore.create.mock.calls[0][0].data.familyId).toBe(
      "family-persistent-1",
    );
  });

  it("rejects revoked refresh-token reuse and revokes its family", async () => {
    const refreshTokenStore = {
      findUnique: jest.fn().mockResolvedValue({
        id: "stored-1",
        userId: "user-1",
        familyId: "family-1",
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
      create: jest.fn(),
    };
    const { service } = createAuthService({ refreshToken: refreshTokenStore });

    await expect(service.refresh(refreshToken())).rejects.toBeInstanceOf(UnauthorizedException);
    const revokeFamilyArgs = refreshTokenStore.updateMany.mock.calls[0][0];
    expect(revokeFamilyArgs.where).toEqual({ familyId: "family-1", revokedAt: null });
    expect(revokeFamilyArgs.data.revokedAt).toBeInstanceOf(Date);
  });

  it("rejects expired refresh tokens", async () => {
    const { service } = createAuthService({
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: "stored-1",
          userId: "user-1",
          familyId: "family-1",
          revokedAt: null,
          expiresAt: new Date(Date.now() - 1_000),
        }),
        updateMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    });

    await expect(service.refresh(refreshToken())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("does not refresh a suspended citizen session", async () => {
    const refreshTokenStore = {
      findUnique: jest.fn().mockResolvedValue({
        id: "stored-1",
        userId: "user-1",
        familyId: "family-1",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn(),
      create: jest.fn(),
    };
    const { service } = createAuthService({
      refreshToken: refreshTokenStore,
      user: { findUnique: jest.fn().mockResolvedValue(activeUser("Suspended")) },
    });

    await expect(service.refresh(refreshToken())).rejects.toBeInstanceOf(ForbiddenException);
    expect(refreshTokenStore.create).not.toHaveBeenCalled();
  });

  it("keeps access and refresh token purposes cryptographically separate", async () => {
    const accessToken = signJwt({ sub: "user-1", typ: "user" }, accessSecret, "15m");
    const token = refreshToken();

    expect(() => verifyJwt(accessToken, refreshSecret)).toThrow();
    expect(() => verifyJwt(token, accessSecret)).toThrow();
    const verifiedAccess = verifyJwt(accessToken, accessSecret);
    expect(verifiedAccess.exp - verifiedAccess.iat).toBe(15 * 60);
  });

  it("logout revokes the supplied refresh token hash", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const { service } = createAuthService({
      refreshToken: { updateMany, create: jest.fn() },
    });

    await service.logout("refresh-to-revoke");

    const logoutArgs = updateMany.mock.calls[0][0];
    expect(logoutArgs.where).toEqual({
      tokenHash: hashToken("refresh-to-revoke"),
      revokedAt: null,
    });
    expect(logoutArgs.data.revokedAt).toBeInstanceOf(Date);
  });
});

describe("AuthService password reset (AUTH-007 token security)", () => {
  it("rejects invalid reset tokens", async () => {
    const { service, prisma } = createAuthService();
    prisma.passwordResetToken.findUnique.mockResolvedValueOnce(null);
    await expect(service.confirmPasswordReset("missing-token", "Password123!")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("rejects expired reset tokens", async () => {
    const { service, prisma } = createAuthService();
    prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: "reset-1",
      userId: "user-1",
      usedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
    });
    await expect(service.confirmPasswordReset("expired-token", "Password123!")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("rejects already-used reset tokens", async () => {
    const { service, prisma } = createAuthService();
    prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: "reset-1",
      userId: "user-1",
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(service.confirmPasswordReset("used-token", "Password123!")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("confirms password reset and rotates refresh sessions", async () => {
    const { service, prisma } = createAuthService();
    const token = "valid-reset-token";
    prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: "reset-1",
      userId: "user-1",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      tokenHash: hashToken(token),
    });
    prisma.user.update = jest.fn().mockResolvedValue({});
    prisma.refreshToken.updateMany = jest.fn().mockResolvedValue({ count: 1 });

    const result = await service.confirmPasswordReset(token, "Password123!");
    expect(result).toEqual({ ok: true });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
