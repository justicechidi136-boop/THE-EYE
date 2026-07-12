import { ConflictException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { UserRole } from "@the-eye/shared";
import { AuthService } from "../auth.service";

function createFirebaseAuthService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    authAccount: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "auth-1" }),
      upsert: jest.fn().mockResolvedValue({ id: "auth-1" }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    refreshToken: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    ...overrides,
  };

  const config = {
    get: (key: string, fallback?: string) => {
      if (key === "JWT_ACCESS_TTL") return "15m";
      if (key === "JWT_REFRESH_TTL") return "30d";
      if (key === "JWT_ACCESS_SECRET") return "test-access-secret-32-characters-min";
      if (key === "JWT_REFRESH_SECRET") return "test-refresh-secret-32-characters-min";
      if (key === "FIREBASE_PROJECT_ID") return "the-eye-2pd-d0217";
      return fallback;
    },
  };

  const firebaseVerifier = {
    verify: jest.fn().mockResolvedValue({
      uid: "firebase-google-uid",
      provider: "google.com",
      email: "citizen@theeye.local",
      emailVerified: true,
      name: "Citizen User",
    }),
  };

  return {
    service: new AuthService(
      prisma as never,
      config as never,
      { record: jest.fn() } as never,
      firebaseVerifier as never,
    ),
    prisma,
    firebaseVerifier,
  };
}

describe("AuthService Firebase exchange", () => {
  it("creates a new citizen for a first-time Google Firebase login", async () => {
    const { service, prisma } = createFirebaseAuthService();
    prisma.user.create.mockResolvedValue({
      id: "user-1",
      email: "citizen@theeye.local",
      phone: null,
      status: "Active",
      profile: {
        firstName: "Citizen",
        lastName: "User",
        country: "Nigeria",
        state: "Lagos",
        lga: "Ikeja",
      },
      trustedReporter: null,
    });

    const session = await service.exchangeFirebaseToken({
      idToken: "valid-token",
      provider: "google.com",
      platform: "android",
    });

    expect(session.accessToken.length).toBeGreaterThan(0);
    expect(session.refreshToken.length).toBeGreaterThan(0);
    expect(session.user.role).toBe(UserRole.Citizen);
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it("rejects suspended users before issuing tokens", async () => {
    const { service, prisma } = createFirebaseAuthService();
    prisma.authAccount.findUnique.mockResolvedValue({
      userId: "user-suspended",
      provider: "google.com",
      providerSubject: "firebase-google-uid",
      user: {
        id: "user-suspended",
        email: "citizen@theeye.local",
        phone: null,
        status: "Suspended",
        profile: null,
        trustedReporter: null,
      },
    });

    try {
      await service.exchangeFirebaseToken({
        idToken: "valid-token",
        provider: "google.com",
      });
      throw new Error("Expected suspended account failure");
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
    }
  });

  it("returns account collision when email already has a password", async () => {
    const { service, prisma } = createFirebaseAuthService();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-password",
      email: "citizen@theeye.local",
      passwordHash: "hashed-password",
      authAccounts: [],
      profile: null,
      trustedReporter: null,
    });

    try {
      await service.exchangeFirebaseToken({
        idToken: "valid-token",
        provider: "google.com",
      });
      throw new Error("Expected account collision");
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
    }
  });

  it("rejects invalid Firebase tokens", async () => {
    const { service, firebaseVerifier } = createFirebaseAuthService();
    firebaseVerifier.verify.mockImplementation(() => Promise.reject(new Error("Invalid Firebase token")));

    try {
      await service.exchangeFirebaseToken({
        idToken: "bad-token",
        provider: "google.com",
      });
      throw new Error("Expected invalid token failure");
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
    }
  });
});
