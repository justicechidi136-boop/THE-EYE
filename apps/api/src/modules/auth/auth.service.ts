import { randomUUID } from "crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { AdminRoleName, adminRolePermissions, userRolePermissions, UserRole } from "@the-eye/shared";
import type { VerifiedFirebaseIdentity } from "../../common/auth/firebase-id-token";
import { peekFirebaseIdToken } from "../../common/auth/firebase-id-token";
import { FirebaseAuthVerifier } from "../../common/auth/firebase-auth.verifier";
import { resolveAppEnvironment } from "../../common/auth/firebase-environment";
import { assertFirebaseProjectConfigured } from "../../common/auth/firebase-project";
import { hashOtp, hashPassword, hashToken, randomToken, verifyPassword } from "../../common/auth/crypto";
import { parseTtl, signJwt, verifyJwt, type JwtPayload } from "../../common/auth/jwt";
import { requireJwtAccessSecret, requireJwtRefreshSecret } from "../../common/auth/jwt-secrets";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuthDeliveryService } from "./auth-delivery.service";
import type { FirebaseExchangeDto, FirebaseLinkDto } from "./dto/auth.dto";
import { isValidPhoneNumber, normalizePhoneNumber } from "./phone-normalize";

const ADMIN_ROLE_NAMES = new Set<string>(Object.values(AdminRoleName));

type LoginInput = {
  email?: string;
  phone?: string;
  password: string;
  admin?: boolean;
};

type GoogleInput = {
  idToken?: string;
  googleId?: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(FirebaseAuthVerifier) private readonly firebaseVerifier: FirebaseAuthVerifier,
    @Inject(AuthDeliveryService) private readonly authDelivery: AuthDeliveryService,
  ) {}

  async login(dto: LoginInput) {
    if (!dto.email && !dto.phone) throw new BadRequestException("Email or phone is required");
    return dto.admin ? this.loginAdmin(dto) : this.loginUser(dto);
  }

  async register(dto: { email: string; password: string; firstName?: string; lastName?: string }) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({
        message: "An account with this email already exists. Sign in or reset your password.",
        code: "EMAIL_ALREADY_REGISTERED",
      });
    }

    const firstName = dto.firstName?.trim();
    const lastName = dto.lastName?.trim();
    if (!firstName || !lastName) {
      throw new BadRequestException("First name and last name are required.");
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: hashPassword(dto.password),
        profile: {
          create: {
            firstName,
            lastName,
            ...this.incompleteProfileLocation(),
          },
        },
      },
      include: { trustedReporter: true, profile: true },
    });

    await this.audit.record({
      actor: { sub: user.id, typ: "user", role: UserRole.Citizen, permissions: [] },
      action: "auth.register",
      entityType: "users",
      entityId: user.id,
      metadata: { email },
    });

    const profileComplete = this.isProfileComplete(user.profile ?? null);
    const session = await this.issueUserSession(user);
    return { ...session, profileComplete };
  }

  async googleLogin(dto: GoogleInput) {
    if (!dto.idToken) throw new BadRequestException("Google ID token is required");
    const google = await this.verifyGoogleToken(dto.idToken);
    if (dto.email && dto.email.toLowerCase() !== google.email.toLowerCase()) {
      throw new UnauthorizedException("Google identity does not match the requested email");
    }

    const user = await this.prisma.user.upsert({
      where: { email: google.email },
      update: { googleId: google.sub },
      create: {
        email: google.email,
        googleId: google.sub,
        profile: {
          create: {
            firstName: dto.firstName ?? google.given_name ?? this.nameFromEmail(google.email).firstName,
            lastName: dto.lastName ?? google.family_name ?? this.nameFromEmail(google.email).lastName,
            ...this.incompleteProfileLocation(),
          },
        },
      },
      include: { trustedReporter: true, profile: true },
    });

    return this.issueUserSession(user);
  }

  async exchangeFirebaseToken(dto: FirebaseExchangeDto) {
    if (dto.provider !== "google.com" && dto.provider !== "apple.com") {
      throw new BadRequestException("Unsupported auth provider");
    }

    const identity = await this.verifyFirebaseIdentity(dto.idToken, dto.provider);
    const user = await this.resolveFirebaseUser(identity);
    this.assertUserCanSignIn(user);

    await this.audit.record({
      actor: { sub: user.id, typ: "user", role: UserRole.Citizen, permissions: [] },
      action: "auth.firebase.exchange",
      entityType: "users",
      entityId: user.id,
      metadata: {
        provider: identity.provider,
        platform: dto.platform ?? null,
        deviceId: dto.deviceId ?? null,
        emailVerified: identity.emailVerified,
      },
    });

    const profileComplete = this.isProfileComplete(user.profile ?? null);
    const session = await this.issueUserSession(user);
    return { ...session, profileComplete };
  }

  async linkProvider(userId: string, dto: FirebaseLinkDto) {
    if (dto.provider !== "google.com" && dto.provider !== "apple.com") {
      throw new BadRequestException("Unsupported auth provider");
    }

    const identity = await this.verifyFirebaseIdentity(dto.idToken, dto.provider);
    const existing = await this.prisma.authAccount.findUnique({
      where: { provider_providerSubject: { provider: identity.provider, providerSubject: identity.uid } },
    });
    if (existing && existing.userId !== userId) {
      throw new ConflictException({
        message: "This sign-in provider is already linked to another THE EYE account.",
        code: "ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL",
      });
    }
    if (existing?.userId === userId) return { ok: true };

    await this.prisma.authAccount.create({
      data: {
        userId,
        provider: identity.provider,
        providerSubject: identity.uid,
        providerEmail: identity.email ?? null,
        emailVerified: identity.emailVerified,
      },
    });

    if (identity.provider === "google.com") {
      await this.prisma.user.update({ where: { id: userId }, data: { googleId: identity.uid } });
    }

    return { ok: true };
  }

  async unlinkProvider(userId: string, provider: string) {
    if (provider !== "google.com" && provider !== "apple.com") {
      throw new BadRequestException("Unsupported auth provider");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { authAccounts: true },
    });
    if (!user) throw new UnauthorizedException("User not found");

    const remainingProviders = user.authAccounts.filter((account) => account.provider !== provider);
    const hasPassword = Boolean(user.passwordHash);
    const hasPhone = Boolean(user.phone);
    if (!hasPassword && !hasPhone && remainingProviders.length === 0) {
      throw new ForbiddenException("Keep at least one sign-in method before unlinking this provider.");
    }

    await this.prisma.authAccount.deleteMany({ where: { userId, provider } });
    if (provider === "google.com") {
      await this.prisma.user.update({ where: { id: userId }, data: { googleId: null } });
    }
    return { ok: true };
  }

  async refresh(refreshToken: string) {
    const payload = verifyJwt(refreshToken, requireJwtRefreshSecret(this.config));
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      if (stored?.revokedAt && stored.familyId) {
        await this.prisma.refreshToken.updateMany({
          where: { familyId: stored.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

    if (payload.typ === "admin" && stored.adminUserId) {
      const admin = await this.prisma.adminUser.findUnique({
        where: { id: stored.adminUserId },
        include: { role: true },
      });
      if (!admin) throw new UnauthorizedException("Admin not found");
      return this.issueAdminSession(admin, stored.familyId);
    }

    if (stored.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: stored.userId },
        include: { trustedReporter: true },
      });
      if (!user) throw new UnauthorizedException("User not found");
      return this.issueUserSession(user, stored.familyId);
    }

    throw new UnauthorizedException("Invalid refresh token owner");
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { ok: true };

    const token = randomToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    await this.authDelivery.sendPasswordResetEmail(email, token);
    return this.authDelivery.allowDevAuthCodes()
      ? { ok: true, devResetToken: token }
      : { ok: true };
  }

  async confirmPasswordReset(token: string, newPassword: string) {
    const tokenHash = hashToken(token);
    const stored = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: stored.userId }, data: { passwordHash: hashPassword(newPassword) } }),
      this.prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    return { ok: true };
  }

  async requestPhoneOtp(phone: string, purpose: string) {
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!isValidPhoneNumber(normalizedPhone)) throw new BadRequestException("Enter a valid phone number");

    const recentCount = await this.prisma.phoneOtp.count({
      where: { phone: normalizedPhone, purpose, createdAt: { gt: new Date(Date.now() - 60_000) } },
    });
    if (recentCount >= 3) throw new HttpException("Too many OTP requests. Wait a minute and try again.", HttpStatus.TOO_MANY_REQUESTS);

    const code = String((parseInt(randomToken(4).slice(0, 8), 16) % 900000) + 100000);
    const user = await this.prisma.user.findUnique({ where: { phone: normalizedPhone } });

    await this.prisma.phoneOtp.create({
      data: {
        userId: user?.id,
        phone: normalizedPhone,
        purpose,
        codeHash: hashOtp(normalizedPhone, code, purpose),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    await this.authDelivery.sendPhoneOtp(normalizedPhone, code, purpose);
    return this.authDelivery.allowDevAuthCodes()
      ? { ok: true, devOtp: code }
      : { ok: true };
  }

  async verifyPhoneOtp(phone: string, code: string, purpose: string) {
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!isValidPhoneNumber(normalizedPhone)) throw new BadRequestException("Enter a valid phone number");

    const otp = await this.prisma.phoneOtp.findFirst({
      where: { phone: normalizedPhone, purpose },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) throw new BadRequestException("No active OTP found. Request a new code.");
    if (otp.verifiedAt) throw new BadRequestException("This OTP has already been used.");
    if (otp.expiresAt <= new Date()) throw new BadRequestException("OTP expired. Request a new code.");
    if (otp.attempts >= 5) throw new BadRequestException("OTP locked due to too many attempts.");

    if (otp.codeHash !== hashOtp(normalizedPhone, code, purpose)) {
      await this.prisma.phoneOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException("Invalid OTP code.");
    }

    const user = await this.prisma.user.upsert({
      where: { phone: normalizedPhone },
      update: { phoneVerifiedAt: new Date() },
      create: { phone: normalizedPhone, phoneVerifiedAt: new Date() },
      include: { trustedReporter: true },
    });

    await this.prisma.phoneOtp.update({ where: { id: otp.id }, data: { verifiedAt: new Date(), userId: user.id } });
    return this.issueUserSession(user);
  }

  private async loginUser(dto: LoginInput) {
    const normalizedPhone = dto.phone ? normalizePhoneNumber(dto.phone) : undefined;
    if (dto.phone && !isValidPhoneNumber(normalizedPhone!)) throw new BadRequestException("Enter a valid phone number");

    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email ?? undefined }, { phone: normalizedPhone ?? undefined }] },
      include: { trustedReporter: true },
    });

    if (!user || !verifyPassword(dto.password, user.passwordHash)) throw new UnauthorizedException("Invalid credentials");
    return this.issueUserSession(user);
  }

  private async loginAdmin(dto: LoginInput) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email: dto.email ?? "" },
      include: { role: true },
    });

    if (!admin || !admin.isActive || !verifyPassword(dto.password, admin.passwordHash)) {
      throw new UnauthorizedException("Invalid admin credentials");
    }

    if (!ADMIN_ROLE_NAMES.has(admin.role.name)) throw new UnauthorizedException("Unsupported admin role");
    const session = await this.issueAdminSession(admin);
    await this.audit.record({
      actor: session.user,
      action: "admin.login",
      entityType: "admin_users",
      entityId: admin.id,
      metadata: { role: admin.role.name, country: admin.country, state: admin.state, lga: admin.lga },
    });
    return session;
  }

  private async issueUserSession(user: { id: string; email: string | null; phone: string | null; trustedReporter?: unknown }, familyId?: string) {
    const role = user.trustedReporter ? UserRole.TrustedReporter : UserRole.Citizen;
    const payload: JwtPayload = {
      sub: user.id,
      typ: "user",
      email: user.email ?? undefined,
      phone: user.phone ?? undefined,
      role,
      permissions: userRolePermissions[role],
    };
    return this.issueSession(payload, { userId: user.id }, familyId);
  }

  private async issueAdminSession(admin: { id: string; email: string; role: { name: string }; country: string; state: string; lga: string; agencyId: string | null; jurisdictionId: string }, familyId?: string) {
    const role = admin.role.name as AdminRoleName;
    const payload: JwtPayload = {
      sub: admin.id,
      typ: "admin",
      email: admin.email,
      role,
      permissions: adminRolePermissions[role],
      country: admin.country,
      state: admin.state,
      lga: admin.lga,
      agencyId: admin.agencyId ?? undefined,
      jurisdictionId: admin.jurisdictionId,
    };
    return this.issueSession(payload, { adminUserId: admin.id }, familyId);
  }

  private async verifyGoogleToken(idToken: string) {
    const clientId = this.config.get<string>("GOOGLE_OAUTH_CLIENT_ID");
    if (!clientId) throw new UnauthorizedException("Google login is not configured");

    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new UnauthorizedException("Invalid Google identity token");
    const payload = await response.json() as {
      aud?: string;
      sub?: string;
      email?: string;
      email_verified?: string;
      given_name?: string;
      family_name?: string;
    };
    if (payload.aud !== clientId || !payload.sub || !payload.email || payload.email_verified !== "true") {
      throw new UnauthorizedException("Untrusted Google identity token");
    }
    return payload as typeof payload & { sub: string; email: string };
  }

  private async issueSession(payload: JwtPayload, owner: { userId?: string; adminUserId?: string }, familyId?: string) {
    const accessToken = signJwt(payload, requireJwtAccessSecret(this.config), this.config.get<string>("JWT_ACCESS_TTL", "15m"));
    const refreshPayload: JwtPayload = { sub: payload.sub, typ: payload.typ, jti: randomUUID() };
    const refreshTtl = this.config.get<string>("JWT_REFRESH_TTL", "30d");
    const refreshToken = signJwt(refreshPayload, requireJwtRefreshSecret(this.config), refreshTtl);
    const expiresAt = new Date(Date.now() + parseTtl(refreshTtl, 30 * 24 * 60 * 60) * 1000);

    await this.prisma.refreshToken.create({
      data: {
        ...owner,
        tokenHash: hashToken(refreshToken),
        familyId: familyId ?? randomUUID(),
        expiresAt,
      },
    });

    return { accessToken, refreshToken, user: payload };
  }

  private async verifyFirebaseIdentity(idToken: string, expectedProvider: "google.com" | "apple.com") {
    const expectedProjectId = assertFirebaseProjectConfigured(this.config);
    try {
      return await this.firebaseVerifier.verify(idToken, expectedProvider);
    } catch (error) {
      const peek = peekFirebaseIdToken(idToken);
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Firebase token verification failed (expectedProject=${expectedProjectId}, ` +
          `tokenAud=${peek?.aud ?? "unknown"}, tokenIss=${peek?.iss ?? "unknown"}, ` +
          `tokenExp=${peek?.exp ?? "unknown"}, tokenProvider=${peek?.provider ?? "unknown"}, ` +
          `expectedProvider=${expectedProvider}): ${reason}`,
      );
      const appEnv = resolveAppEnvironment({
        THE_EYE_APP_ENV: this.config.get<string>("THE_EYE_APP_ENV"),
        FCM_PROJECT_ID: this.config.get<string>("FCM_PROJECT_ID"),
        FIREBASE_PROJECT_ID: this.config.get<string>("FIREBASE_PROJECT_ID"),
        NODE_ENV: process.env.NODE_ENV,
      });
      if (appEnv === "staging" && peek?.aud && peek.aud !== expectedProjectId) {
        throw new UnauthorizedException({
          message: "Invalid Firebase identity token",
          code: "FIREBASE_TOKEN_PROJECT_MISMATCH",
          expectedProjectId,
          tokenAud: peek.aud,
          tokenIss: peek.iss ?? null,
        });
      }
      throw new UnauthorizedException("Invalid Firebase identity token");
    }
  }

  private async resolveFirebaseUser(identity: VerifiedFirebaseIdentity) {
    const linked = await this.prisma.authAccount.findUnique({
      where: { provider_providerSubject: { provider: identity.provider, providerSubject: identity.uid } },
      include: { user: { include: { profile: true, trustedReporter: true } } },
    });
    if (linked) return linked.user;

    const normalizedEmail = identity.email ? this.normalizeEmail(identity.email) : undefined;
    if (normalizedEmail && identity.emailVerified) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: { profile: true, trustedReporter: true, authAccounts: true },
      });
      if (existingUser) {
        this.assertSafeProviderLink(existingUser, identity);
        return this.linkFirebaseIdentityToUser(existingUser, identity);
      }
    }

    if (identity.provider === "google.com" && normalizedEmail) {
      const legacyUser = await this.prisma.user.findFirst({
        where: { OR: [{ googleId: identity.uid }, { email: normalizedEmail }] },
        include: { profile: true, trustedReporter: true, authAccounts: true },
      });
      if (legacyUser) {
        this.assertSafeProviderLink(legacyUser, identity);
        return this.linkFirebaseIdentityToUser(legacyUser, identity);
      }
    }

    try {
      return await this.createFirebaseCitizen(identity);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const raced = await this.prisma.authAccount.findUnique({
          where: { provider_providerSubject: { provider: identity.provider, providerSubject: identity.uid } },
          include: { user: { include: { profile: true, trustedReporter: true } } },
        });
        if (raced) return raced.user;
      }
      throw error;
    }
  }

  private assertSafeProviderLink(
    user: {
      id: string;
      passwordHash: string | null;
      authAccounts: { provider: string; providerSubject: string }[];
    },
    identity: VerifiedFirebaseIdentity,
  ) {
    if (user.passwordHash) {
      throw new ConflictException({
        message:
          "An account already exists with this email. Sign in with your original method, then link this provider from Settings.",
        code: "ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL",
      });
    }

    const hasDifferentCredential = user.authAccounts.some(
      (account) => account.provider !== identity.provider || account.providerSubject !== identity.uid,
    );
    if (user.authAccounts.length > 0 && hasDifferentCredential) {
      throw new ConflictException({
        message:
          "This email is linked to another sign-in method. Use your original sign-in method and link this provider from Settings.",
        code: "ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL",
      });
    }
  }

  private async linkFirebaseIdentityToUser(
    user: { id: string; profile: unknown | null; trustedReporter: unknown | null },
    identity: VerifiedFirebaseIdentity,
  ) {
    await this.prisma.authAccount.upsert({
      where: { provider_providerSubject: { provider: identity.provider, providerSubject: identity.uid } },
      update: {
        providerEmail: identity.email ?? null,
        emailVerified: identity.emailVerified,
      },
      create: {
        userId: user.id,
        provider: identity.provider,
        providerSubject: identity.uid,
        providerEmail: identity.email ?? null,
        emailVerified: identity.emailVerified,
      },
    });

    if (identity.provider === "google.com") {
      await this.prisma.user.update({ where: { id: user.id }, data: { googleId: identity.uid } });
    }

    return this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { profile: true, trustedReporter: true },
    });
  }

  private async createFirebaseCitizen(identity: VerifiedFirebaseIdentity) {
    const names = this.splitDisplayName(identity.name, identity.provider);
    const email = identity.emailVerified && identity.email ? this.normalizeEmail(identity.email) : null;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          googleId: identity.provider === "google.com" ? identity.uid : null,
          profile: {
            create: {
              firstName: names.firstName,
              lastName: names.lastName,
              avatarUrl: identity.picture ?? null,
              ...this.incompleteProfileLocation(),
            },
          },
        },
        include: { profile: true, trustedReporter: true },
      });

      await tx.authAccount.create({
        data: {
          userId: user.id,
          provider: identity.provider,
          providerSubject: identity.uid,
          providerEmail: identity.email ?? null,
          emailVerified: identity.emailVerified,
        },
      });

      return user;
    });
  }

  private assertUserCanSignIn(user: { status: string }) {
    if (user.status === "Suspended") {
      throw new ForbiddenException({
        message: "Your THE EYE account is suspended. Contact support for assistance.",
        code: "ACCOUNT_SUSPENDED",
      });
    }
    if (user.status === "Deactivated") {
      throw new ForbiddenException({
        message: "Your THE EYE account is deactivated.",
        code: "ACCOUNT_DEACTIVATED",
      });
    }
  }

  private incompleteProfileLocation() {
    return { country: "", state: "", lga: "" };
  }

  private isProfileComplete(profile: { firstName: string; lastName: string; country: string; state: string; lga: string } | null) {
    if (!profile) return false;
    const placeholderNames = new Set(["Google", "Apple", "Citizen"]);
    if (placeholderNames.has(profile.firstName) || profile.lastName === "User") return false;
    return Boolean(profile.firstName && profile.lastName && profile.country && profile.state && profile.lga);
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private splitDisplayName(name: string | undefined, provider: "google.com" | "apple.com") {
    if (!name?.trim()) {
      const fallback = provider === "apple.com" ? "apple" : "google";
      return this.nameFromEmail(`${fallback}@provider.local`);
    }
    const parts = name.trim().split(/\s+/);
    return {
      firstName: parts[0] ?? "Citizen",
      lastName: parts.length > 1 ? parts.slice(1).join(" ") : parts[0] ?? "Citizen",
    };
  }

  private nameFromEmail(email: string) {
    const localPart = email.split("@")[0]?.trim() ?? "citizen";
    const segments = localPart.split(/[._-]+/).filter(Boolean);
    if (segments.length >= 2) {
      return {
        firstName: this.titleCase(segments[0]!),
        lastName: this.titleCase(segments.slice(1).join(" ")),
      };
    }
    return { firstName: this.titleCase(localPart), lastName: "Account" };
  }

  private titleCase(value: string) {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }
}

