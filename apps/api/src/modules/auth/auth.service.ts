import { randomUUID } from "crypto";
import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AdminRoleName, adminRolePermissions, userRolePermissions, UserRole } from "@the-eye/shared";
import { hashOtp, hashPassword, hashToken, randomToken, verifyPassword } from "../../common/auth/crypto";
import { signJwt, verifyJwt, type JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginInput) {
    if (!dto.email && !dto.phone) throw new BadRequestException("Email or phone is required");
    return dto.admin ? this.loginAdmin(dto) : this.loginUser(dto);
  }

  async googleLogin(dto: GoogleInput) {
    if (!dto.email) throw new BadRequestException("Google email is required");

    const googleId = dto.googleId ?? dto.idToken ?? dto.email;
    const user = await this.prisma.user.upsert({
      where: { email: dto.email },
      update: { googleId },
      create: {
        email: dto.email,
        googleId,
        profile: {
          create: {
            firstName: dto.firstName ?? "Google",
            lastName: dto.lastName ?? "User",
            country: "Nigeria",
            state: "Lagos",
            lga: "Ikeja",
          },
        },
      },
      include: { trustedReporter: true },
    });

    return this.issueUserSession(user);
  }

  async refresh(refreshToken: string) {
    const payload = verifyJwt(refreshToken, this.config.get<string>("JWT_REFRESH_SECRET", "dev-refresh-secret"));
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
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

    return { ok: true, resetToken: token };
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
    const code = this.config.get<string>("NODE_ENV") === "production" ? String(Math.floor(100000 + Math.random() * 900000)) : "123456";
    const user = await this.prisma.user.findUnique({ where: { phone } });

    await this.prisma.phoneOtp.create({
      data: {
        userId: user?.id,
        phone,
        purpose,
        codeHash: hashOtp(phone, code, purpose),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    return { ok: true, devOtp: this.config.get<string>("NODE_ENV") === "production" ? undefined : code };
  }

  async verifyPhoneOtp(phone: string, code: string, purpose: string) {
    const codeHash = hashOtp(phone, code, purpose);
    const otp = await this.prisma.phoneOtp.findFirst({
      where: { phone, purpose, codeHash, verifiedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) throw new BadRequestException("Invalid or expired OTP");

    const user = await this.prisma.user.upsert({
      where: { phone },
      update: { phoneVerifiedAt: new Date() },
      create: { phone, phoneVerifiedAt: new Date() },
      include: { trustedReporter: true },
    });

    await this.prisma.phoneOtp.update({ where: { id: otp.id }, data: { verifiedAt: new Date(), userId: user.id } });
    return this.issueUserSession(user);
  }

  private async loginUser(dto: LoginInput) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email ?? undefined }, { phone: dto.phone ?? undefined }] },
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

  private async issueSession(payload: JwtPayload, owner: { userId?: string; adminUserId?: string }, familyId?: string) {
    const accessToken = signJwt(payload, this.config.get<string>("JWT_ACCESS_SECRET", "dev-access-secret"), this.config.get<string>("JWT_ACCESS_TTL", "15m"));
    const refreshPayload: JwtPayload = { sub: payload.sub, typ: payload.typ };
    const refreshToken = signJwt(refreshPayload, this.config.get<string>("JWT_REFRESH_SECRET", "dev-refresh-secret"), this.config.get<string>("JWT_REFRESH_TTL", "30d"));
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

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
}

