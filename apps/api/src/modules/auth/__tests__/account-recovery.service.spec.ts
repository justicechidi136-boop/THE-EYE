import { BadRequestException, HttpException, HttpStatus, UnauthorizedException } from "@nestjs/common";
import { AccountRecoveryService } from "../account-recovery.service";

describe("AccountRecoveryService", () => {
  const prisma = {
    accountRecoveryChallenge: {
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    authAccount: { upsert: jest.fn() },
    refreshToken: { updateMany: jest.fn() },
    userPushToken: { findMany: jest.fn() },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  };
  const audit = { record: jest.fn() };
  const authDelivery = {
    sendAccountRecoveryEmail: jest.fn(),
    allowDevAuthCodes: jest.fn().mockReturnValue(false),
  };
  const firebaseVerifier = { verify: jest.fn() };
  const notifications = { create: jest.fn() };
  const config = { get: jest.fn() };

  const service = new AccountRecoveryService(
    prisma as never,
    config as never,
    audit as never,
    authDelivery as never,
    firebaseVerifier as never,
    notifications as never,
  );

  it("returns generic response for unknown email", async () => {
    prisma.accountRecoveryChallenge.count.mockResolvedValueOnce(0);
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const result = await service.requestRecovery("unknown@example.com");
    expect(result.message).toContain("If an eligible account exists");
    expect(authDelivery.sendAccountRecoveryEmail).not.toHaveBeenCalled();
  });

  it("returns the same generic response for password-only accounts", async () => {
    prisma.accountRecoveryChallenge.count.mockResolvedValueOnce(0);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      googleId: null,
      passwordHash: "hash",
      authAccounts: [],
    });
    const result = await service.requestRecovery("password@example.com");
    expect(result.message).toContain("If an eligible account exists");
    expect(prisma.accountRecoveryChallenge.create).not.toHaveBeenCalled();
  });

  it("creates challenge and sends email for google-linked account", async () => {
    prisma.accountRecoveryChallenge.count.mockResolvedValueOnce(0);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      googleId: "google-sub",
      passwordHash: null,
      authAccounts: [{ provider: "google.com", providerSubject: "google-sub" }],
    });
    prisma.accountRecoveryChallenge.create.mockResolvedValueOnce({ id: "challenge-1" });
    prisma.userPushToken.findMany.mockResolvedValueOnce([]);
    authDelivery.sendAccountRecoveryEmail.mockResolvedValueOnce(undefined);

    const result = await service.requestRecovery("citizen@example.com");
    expect(result.ok).toBe(true);
    expect(prisma.accountRecoveryChallenge.create).toHaveBeenCalled();
  });

  it("continues when security push enqueue fails", async () => {
    prisma.accountRecoveryChallenge.count.mockResolvedValueOnce(0);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      googleId: "google-sub",
      passwordHash: null,
      authAccounts: [{ provider: "google.com", providerSubject: "google-sub" }],
    });
    prisma.accountRecoveryChallenge.create.mockResolvedValueOnce({ id: "challenge-1" });
    prisma.userPushToken.findMany.mockResolvedValueOnce([{ id: "token-1" }]);
    authDelivery.sendAccountRecoveryEmail.mockResolvedValueOnce(undefined);
    notifications.create.mock.onceQueue.push(
      Promise.reject(new Error("queue unavailable")),
    );

    const result = await service.requestRecovery("citizen@example.com");
    expect(result.ok).toBe(true);
  });

  it("rate limits excessive recovery requests", async () => {
    prisma.accountRecoveryChallenge.count.mockImplementation(() => Promise.resolve(5));
    let caught: unknown;
    try {
      await service.requestRecovery("citizen@example.com");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(HttpException);
    expect((caught as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  it("rejects expired recovery token", async () => {
    prisma.accountRecoveryChallenge.findUnique.mockResolvedValueOnce({
      id: "challenge-1",
      userId: "user-1",
      provider: "google.com",
      status: "pending",
      usedAt: null,
      cancelledAt: null,
      expiresAt: new Date(Date.now() - 60_000),
    });
    prisma.accountRecoveryChallenge.update.mockResolvedValueOnce({ id: "challenge-1" });

    await expect(service.verifyRecoveryToken("expired-token")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("cancels an active recovery challenge", async () => {
    prisma.accountRecoveryChallenge.findUnique.mockResolvedValueOnce({
      id: "challenge-1",
      userId: "user-1",
      provider: "google.com",
      status: "pending",
      usedAt: null,
      cancelledAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.accountRecoveryChallenge.update.mockResolvedValueOnce({ id: "challenge-1" });

    const result = await service.cancelRecovery("active-token");
    expect(result.ok).toBe(true);
  });

  it("blocks provider UID mismatch during completion", async () => {
    prisma.accountRecoveryChallenge.findUnique.mockResolvedValueOnce({
      id: "challenge-1",
      userId: "user-1",
      provider: "google.com",
      status: "pending",
      usedAt: null,
      cancelledAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    firebaseVerifier.verify.mockResolvedValueOnce({
      provider: "google.com",
      uid: "other-sub",
      email: "citizen@example.com",
      emailVerified: true,
    });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      googleId: "google-sub",
      authAccounts: [{ provider: "google.com", providerSubject: "google-sub" }],
    });

    await expect(
      service.completeRecovery("token-1", "id-token", "google.com"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects completed recovery token on second complete attempt", async () => {
    prisma.accountRecoveryChallenge.findUnique
      .mockResolvedValueOnce({
        id: "challenge-1",
        userId: "user-1",
        provider: "google.com",
        status: "pending",
        usedAt: null,
        cancelledAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      })
      .mockResolvedValueOnce({
        id: "challenge-1",
        userId: "user-1",
        provider: "google.com",
        status: "completed",
        usedAt: new Date(),
        cancelledAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
    firebaseVerifier.verify.mockResolvedValueOnce({
      provider: "google.com",
      uid: "google-sub",
      email: "citizen@example.com",
      emailVerified: true,
    });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      googleId: "google-sub",
      authAccounts: [{ provider: "google.com", providerSubject: "google-sub" }],
    });
    prisma.userPushToken.findMany.mockResolvedValueOnce([]);

    await service.completeRecovery("token-1", "id-token", "google.com");
    await expect(
      service.completeRecovery("token-1", "id-token", "google.com"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
