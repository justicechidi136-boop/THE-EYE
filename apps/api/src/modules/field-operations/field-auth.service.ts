import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { FIELD_ERROR_CODES, effectivePreferredLocale } from "@the-eye/shared";
import { hashToken, randomToken, verifyPassword } from "../../common/auth/crypto";
import { parseTtl, signJwt, type JwtPayload } from "../../common/auth/jwt";
import { requireJwtAccessSecret } from "../../common/auth/jwt-secrets";
import { verifyFieldDeviceSignature } from "../../common/auth/field-device-crypto";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { FieldDevicesService } from "./field-devices.service";
import type { FieldLoginDto, FieldRefreshDto } from "./dto/field-devices.dto";

@Injectable()
export class FieldAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly devices: FieldDevicesService,
  ) {}

  async login(dto: FieldLoginDto) {
    const device = await this.prisma.fieldDevice.findUnique({ where: { publicDeviceId: dto.publicDeviceId } });
    if (!device) {
      throw new UnauthorizedException({ code: FIELD_ERROR_CODES.DEVICE_REGISTRATION_REQUIRED, message: "Device registration required" });
    }
    if (device.registrationStatus === "PendingApproval") {
      throw new ForbiddenException({ code: FIELD_ERROR_CODES.DEVICE_APPROVAL_PENDING, message: "Approval pending" });
    }
    this.devices.assertDeviceCanAuthenticate(device);

    const challenge = await this.prisma.fieldDeviceRegistrationChallenge.findUnique({ where: { id: dto.challengeId } });
    if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date() || challenge.challengeHash !== hashToken(dto.challenge)) {
      throw new UnauthorizedException({ code: FIELD_ERROR_CODES.DEVICE_SIGNATURE_INVALID, message: "Login challenge invalid" });
    }
    if (!device.publicKey || !verifyFieldDeviceSignature(device.publicKey, dto.challenge, dto.challengeSignature)) {
      throw new UnauthorizedException({ code: FIELD_ERROR_CODES.DEVICE_SIGNATURE_INVALID, message: "Device signature invalid" });
    }
    await this.prisma.fieldDeviceRegistrationChallenge.update({
      where: { id: dto.challengeId },
      data: { consumedAt: new Date() },
    });

    const email = dto.email.trim().toLowerCase();
    const admin = await this.prisma.adminUser.findUnique({ where: { email }, include: { role: true, preferences: true } });
    if (!admin?.isActive || !verifyPassword(dto.password, admin.passwordHash)) {
      throw new UnauthorizedException("Invalid credentials");
    }
    if (device.assignedUserId && device.assignedUserId !== admin.id) {
      throw new ForbiddenException({ code: FIELD_ERROR_CODES.JURISDICTION_MISMATCH, message: "Device assigned to another officer" });
    }
    const { fieldRole, permissions } = await this.devices.loadAdminActor(admin.id);

    if (dto.packageName && device.packageName && dto.packageName !== device.packageName) {
      throw new ForbiddenException("Package identity mismatch");
    }

    const session = await this.createSession(device.id, admin.id, device.tokenVersion, {
      sub: admin.id,
      typ: "field",
      email: admin.email,
      role: admin.role.name,
      fieldRole,
      permissions,
      country: admin.country,
      preferredLocale: admin.preferences?.preferredLocale ?? undefined,
      effectivePreferredLocale: effectivePreferredLocale(admin.preferences?.preferredLocale),
      state: admin.state,
      lga: admin.lga,
      agencyId: admin.agencyId ?? undefined,
      jurisdictionId: admin.jurisdictionId,
      fieldDeviceId: device.id,
      assignedUnitId: device.assignedUnitId ?? undefined,
      authMode: "field_tablet",
    });

    await this.prisma.fieldDevice.update({
      where: { id: device.id },
      data: { lastAuthenticatedAt: new Date(), assignedUserId: admin.id },
    });

    await this.audit.record({
      actor: { sub: admin.id, typ: "admin", role: admin.role.name, permissions },
      action: "field.auth.login",
      entityType: "field_device",
      entityId: device.id,
      metadata: { sessionId: session.sessionId, publicDeviceId: device.publicDeviceId },
    });

    return {
      data: {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
        sessionId: session.sessionId,
        device: this.devices.mapDevice(device),
        officer: {
          id: admin.id,
          displayName: admin.displayName,
          role: admin.role.name,
          fieldRole,
          preferredLocale: admin.preferences?.preferredLocale ?? null,
          effectivePreferredLocale: effectivePreferredLocale(admin.preferences?.preferredLocale),
        },
      },
    };
  }

  async refresh(dto: FieldRefreshDto) {
    const device = await this.prisma.fieldDevice.findUnique({ where: { publicDeviceId: dto.publicDeviceId } });
    if (!device) throw new UnauthorizedException("Device not found");
    this.devices.assertDeviceCanAuthenticate(device);

    const session = await this.prisma.fieldDeviceSession.findFirst({
      where: {
        fieldDeviceId: device.id,
        refreshTokenHash: hashToken(dto.refreshToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { adminUser: { include: { role: true, preferences: true } } },
    });
    if (!session || session.tokenVersion !== device.tokenVersion) {
      throw new UnauthorizedException({ code: FIELD_ERROR_CODES.SESSION_EXPIRED, message: "Session expired" });
    }

    const { fieldRole, permissions } = await this.devices.loadAdminActor(session.adminUserId);
    const tokens = await this.issueTokens(session.adminUser, device, session.sessionId, session.tokenVersion, fieldRole, permissions);
    await this.prisma.fieldDeviceSession.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });
    await this.audit.record({
      actor: { sub: session.adminUserId, typ: "admin", permissions },
      action: "field.auth.refresh",
      entityType: "field_device_session",
      entityId: session.id,
    });
    return { data: tokens };
  }

  async logout(actor: JwtPayload) {
    if (actor.typ !== "field" || !actor.sessionId) throw new UnauthorizedException("Field session required");
    await this.prisma.fieldDeviceSession.updateMany({
      where: { sessionId: actor.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      actor: { sub: actor.sub, typ: "admin", permissions: actor.permissions ?? [] },
      action: "field.auth.logout",
      entityType: "field_device_session",
      entityId: actor.sessionId,
    });
    return { data: { signedOut: true } };
  }

  async lock(actor: JwtPayload) {
    if (actor.typ !== "field" || !actor.sessionId) throw new UnauthorizedException("Field session required");
    await this.prisma.fieldDeviceSession.updateMany({
      where: { sessionId: actor.sessionId, revokedAt: null },
      data: { lockedAt: new Date() },
    });
    return { data: { locked: true } };
  }

  async unlock(actor: JwtPayload) {
    if (actor.typ !== "field" || !actor.sessionId) throw new UnauthorizedException("Field session required");
    await this.prisma.fieldDeviceSession.updateMany({
      where: { sessionId: actor.sessionId, revokedAt: null },
      data: { lockedAt: null, lastActiveAt: new Date() },
    });
    await this.audit.record({
      actor: { sub: actor.sub, typ: "admin", permissions: actor.permissions ?? [] },
      action: "field.auth.unlock",
      entityType: "field_device_session",
      entityId: actor.sessionId,
    });
    return { data: { unlocked: true } };
  }

  async getSession(actor: JwtPayload) {
    if (actor.typ !== "field") throw new UnauthorizedException("Field session required");
    const device = actor.fieldDeviceId
      ? await this.prisma.fieldDevice.findUnique({ where: { id: actor.fieldDeviceId } })
      : null;
    return {
      data: {
        sessionId: actor.sessionId,
        userId: actor.sub,
        fieldDeviceId: actor.fieldDeviceId,
        fieldRole: actor.fieldRole,
        agencyId: actor.agencyId,
        assignedUnitId: actor.assignedUnitId,
        preferredLocale: actor.preferredLocale ?? null,
        effectivePreferredLocale: effectivePreferredLocale(actor.preferredLocale ?? actor.effectivePreferredLocale),
        permissions: actor.permissions ?? [],
        device: device ? this.devices.mapDevice(device) : null,
      },
    };
  }

  private async createSession(
    fieldDeviceId: string,
    adminUserId: string,
    tokenVersion: number,
    payload: JwtPayload,
  ) {
    const sessionId = randomUUID();
    const refreshToken = randomToken(48);
    const refreshTtl = this.config.get<string>("JWT_REFRESH_TTL") ?? "7d";
    const expiresAt = new Date(Date.now() + parseTtl(refreshTtl, 604800) * 1000);
    await this.prisma.fieldDeviceSession.create({
      data: {
        fieldDeviceId,
        adminUserId,
        sessionId,
        refreshTokenHash: hashToken(refreshToken),
        tokenVersion,
        expiresAt,
      },
    });
    const accessToken = signJwt(
      { ...payload, sessionId, tokenVersion, jti: randomUUID() },
      requireJwtAccessSecret(this.config),
      this.config.get<string>("JWT_ACCESS_TTL") ?? "15m",
    );
    return {
      sessionId,
      accessToken,
      refreshToken,
      expiresIn: parseTtl(this.config.get<string>("JWT_ACCESS_TTL") ?? "15m", 900),
    };
  }

  private issueTokens(
    admin: {
      id: string;
      email: string;
      role: { name: string };
      country: string;
      state: string;
      lga: string;
      agencyId: string | null;
      jurisdictionId: string;
      preferences?: { preferredLocale?: string | null } | null;
    },
    device: { id: string; tokenVersion: number; assignedUnitId: string | null },
    sessionId: string,
    tokenVersion: number,
    fieldRole: string,
    permissions: string[],
  ) {
    const accessToken = signJwt(
      {
        sub: admin.id,
        typ: "field",
        email: admin.email,
        role: admin.role.name,
        fieldRole,
        permissions,
        country: admin.country,
        preferredLocale: admin.preferences?.preferredLocale ?? undefined,
        effectivePreferredLocale: effectivePreferredLocale(admin.preferences?.preferredLocale),
        state: admin.state,
        lga: admin.lga,
        agencyId: admin.agencyId ?? undefined,
        jurisdictionId: admin.jurisdictionId,
        fieldDeviceId: device.id,
        assignedUnitId: device.assignedUnitId ?? undefined,
        sessionId,
        tokenVersion,
        authMode: "field_tablet",
        jti: randomUUID(),
      },
      requireJwtAccessSecret(this.config),
      this.config.get<string>("JWT_ACCESS_TTL") ?? "15m",
    );
    return {
      accessToken,
      expiresIn: parseTtl(this.config.get<string>("JWT_ACCESS_TTL") ?? "15m", 900),
      sessionId,
    };
  }
}
