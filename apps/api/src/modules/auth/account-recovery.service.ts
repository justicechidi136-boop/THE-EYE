import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FirebaseAuthVerifier } from "../../common/auth/firebase-auth.verifier";
import { hashToken, randomToken } from "../../common/auth/crypto";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuthDeliveryService } from "./auth-delivery.service";
import { NotificationsService } from "../notifications/notifications.service";

const GENERIC_RECOVERY_MESSAGE =
  "If an eligible account exists, recovery instructions have been sent.";

type RecoveryDeviceContext = {
  platform?: string;
  deviceId?: string;
  userAgent?: string;
};

@Injectable()
export class AccountRecoveryService {
  private readonly logger = new Logger(AccountRecoveryService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(AuthDeliveryService) private readonly authDelivery: AuthDeliveryService,
    @Inject(FirebaseAuthVerifier) private readonly firebaseVerifier: FirebaseAuthVerifier,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async requestRecovery(email: string, device?: RecoveryDeviceContext, requestIpHash?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const generic = { ok: true, message: GENERIC_RECOVERY_MESSAGE };

    const recentCount = await this.prisma.accountRecoveryChallenge.count({
      where: {
        emailHash: hashToken(normalizedEmail),
        requestedAt: { gt: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });
    if (recentCount >= 5) {
      throw new HttpException("Too many recovery requests. Try again later.", HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { authAccounts: true },
    });
    if (!user) {
      await this.audit.record({
        actorType: "anonymous",
        action: "account_recovery.requested",
        entityType: "users",
        metadata: { outcome: "no_match" },
      });
      return generic;
    }

    const googleAccount = user.authAccounts.find((account) => account.provider === "google.com");
    const provider = googleAccount ? "google.com" : user.googleId ? "google.com" : user.passwordHash ? "password" : "unknown";
    if (provider !== "google.com") {
      await this.audit.record({
        actor: { sub: user.id, typ: "user", role: "Citizen", permissions: [] },
        action: "account_recovery.blocked",
        entityType: "users",
        entityId: user.id,
        metadata: { reason: "provider_not_supported_for_recovery", provider },
      });
      return generic;
    }

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000);
    await this.prisma.accountRecoveryChallenge.create({
      data: {
        userId: user.id,
        provider,
        emailHash: hashToken(normalizedEmail),
        tokenHash: hashToken(token),
        purpose: "recover_access",
        status: "pending",
        expiresAt,
        requestIpHash,
        requestDevice: {
          platform: device?.platform ?? null,
          deviceId: device?.deviceId ?? null,
          userAgent: device?.userAgent?.slice(0, 256) ?? null,
        },
      },
    });

    await this.authDelivery.sendAccountRecoveryEmail(normalizedEmail, token, expiresAt);
    await this.queueSecurityPush(user.id, "account_recovery_requested");

    await this.audit.record({
      actor: { sub: user.id, typ: "user", role: "Citizen", permissions: [] },
      action: "account_recovery.requested",
      entityType: "users",
      entityId: user.id,
      metadata: { provider, pushQueued: true },
    });

    return this.authDelivery.allowDevAuthCodes()
      ? { ...generic, devRecoveryToken: token }
      : generic;
  }

  async verifyRecoveryToken(token: string) {
    const challenge = await this.findActiveChallenge(token);
    return {
      ok: true,
      status: challenge.status,
      provider: challenge.provider,
      expiresAt: challenge.expiresAt.toISOString(),
    };
  }

  async completeRecovery(token: string, idToken: string, provider: "google.com" | "apple.com") {
    const challenge = await this.findActiveChallenge(token);
    if (challenge.provider !== provider) {
      throw new BadRequestException("Recovery provider mismatch.");
    }

    const identity = await this.firebaseVerifier.verify(idToken, provider);
    const user = await this.prisma.user.findUnique({
      where: { id: challenge.userId },
      include: { profile: true, trustedReporter: true, authAccounts: true },
    });
    if (!user) throw new UnauthorizedException("Recovery could not be completed.");

    const linked = user.authAccounts.find(
      (account) => account.provider === identity.provider && account.providerSubject === identity.uid,
    );
    if (!linked && user.googleId && user.googleId !== identity.uid) {
      await this.audit.record({
        actor: { sub: user.id, typ: "user", role: "Citizen", permissions: [] },
        action: "account_recovery.blocked",
        entityType: "users",
        entityId: user.id,
        metadata: { reason: "provider_uid_mismatch" },
      });
      throw new UnauthorizedException("Google identity does not match this account.");
    }

    if (!linked) {
      await this.prisma.authAccount.upsert({
        where: {
          provider_providerSubject: {
            provider: identity.provider,
            providerSubject: identity.uid,
          },
        },
        update: { userId: user.id, providerEmail: identity.email, emailVerified: identity.emailVerified },
        create: {
          userId: user.id,
          provider: identity.provider,
          providerSubject: identity.uid,
          providerEmail: identity.email,
          emailVerified: identity.emailVerified,
        },
      });
      if (identity.provider === "google.com") {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId: identity.uid },
        });
      }
    }

    await this.prisma.$transaction([
      this.prisma.accountRecoveryChallenge.update({
        where: { id: challenge.id },
        data: {
          status: "completed",
          usedAt: new Date(),
          completedByProviderUid: identity.uid,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.queueSecurityPush(user.id, "account_recovery_completed");
    await this.audit.record({
      actor: { sub: user.id, typ: "user", role: "Citizen", permissions: [] },
      action: "account_recovery.completed",
      entityType: "users",
      entityId: user.id,
      metadata: { provider: identity.provider },
    });

    return { ok: true, userId: user.id, provider: identity.provider };
  }

  async cancelRecovery(token: string) {
    const challenge = await this.findActiveChallenge(token);
    await this.prisma.accountRecoveryChallenge.update({
      where: { id: challenge.id },
      data: { status: "cancelled", cancelledAt: new Date() },
    });
    await this.audit.record({
      actor: { sub: challenge.userId, typ: "user", role: "Citizen", permissions: [] },
      action: "account_recovery.cancelled",
      entityType: "users",
      entityId: challenge.userId,
    });
    return { ok: true };
  }

  private async findActiveChallenge(token: string) {
    const tokenHash = hashToken(token);
    const challenge = await this.prisma.accountRecoveryChallenge.findUnique({
      where: { tokenHash },
    });
    if (!challenge || challenge.status !== "pending" || challenge.usedAt || challenge.cancelledAt) {
      throw new BadRequestException("Invalid or expired recovery link.");
    }
    if (challenge.expiresAt < new Date()) {
      await this.prisma.accountRecoveryChallenge.update({
        where: { id: challenge.id },
        data: { status: "expired" },
      });
      await this.audit.record({
        actor: { sub: challenge.userId, typ: "user", role: "Citizen", permissions: [] },
        action: "account_recovery.expired",
        entityType: "users",
        entityId: challenge.userId,
      });
      throw new BadRequestException("Invalid or expired recovery link.");
    }
    return challenge;
  }

  private async queueSecurityPush(userId: string, category: string) {
    const pushTokens = await this.prisma.userPushToken.findMany({
      where: { userId, isActive: true },
      take: 5,
    });
    if (!pushTokens.length) return;

    const title =
      category === "account_recovery_completed"
        ? "Account recovery completed"
        : "Account recovery requested";
    const body =
      category === "account_recovery_completed"
        ? "Your THE EYE account recovery was completed successfully."
        : "Account recovery was requested for your THE EYE account. If this was not you, secure your account.";

    try {
      await this.notifications.create({
        userId,
        type: "AdminAssignmentAlert",
        priority: "High",
        channels: ["push", "in_app"],
        title,
        body,
        metadata: {
          category,
          route: "/settings",
        },
      });
    } catch (error) {
      this.logger.warn(
        `Account recovery push enqueue failed for user=${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
