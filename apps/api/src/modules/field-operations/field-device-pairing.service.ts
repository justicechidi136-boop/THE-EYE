import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { randomInt } from "crypto";
import {
  FIELD_ERROR_CODES,
  FIELD_PAIRING_ERROR_CODES,
  FIELD_PAIRING_SHORT_CODE_ALPHABET,
  FieldActivationPolicy,
  FieldDeviceRegistrationStatus,
  FieldPairingTokenStatus,
  FieldPreProvisionStatus,
  FieldProvisioningMode,
  formatFieldPairingShortCode,
  normalizeFieldPairingShortCode,
} from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { hashToken, randomToken } from "../../common/auth/crypto";
import { verifyFieldDeviceSignature } from "../../common/auth/field-device-crypto";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { FieldDevicesAdminService } from "./field-devices-admin.service";
import { FieldDevicesService } from "./field-devices.service";
import { FieldLauncherPolicyService } from "./field-launcher-policy.service";
import type {
  CancelPairingDto,
  ClaimFieldPairingDto,
  CompleteFieldPairingClaimDto,
  FieldPairingChallengeDto,
  FieldPairingStatusQuery,
  IssuePairingCodeDto,
} from "./dto/field-device-pairing.dto";

const DEFAULT_PAIRING_TTL_MINUTES = 15;
const MIN_PAIRING_TTL_MINUTES = 5;
const MAX_PAIRING_TTL_MINUTES = 24 * 60;
const MAX_CLAIM_ATTEMPTS = 5;
const DUPLICATE_ACTIVE_CODE_REASON = "DUPLICATE_ACTIVE_ACTIVATION_CODES";
const ACTIVE_PAIRING_STATUSES = [FieldPairingTokenStatus.Issued, FieldPairingTokenStatus.Claimed] as const;

type PairingTokenRow = {
  id: string;
  fieldDeviceId: string;
  status: string;
  expiresAt: Date;
  attemptCount: number;
  maxAttempts: number;
  issuedById: string;
};

/**
 * Secure QR / short-code pairing for pre-provisioned field devices. Tokens and short
 * codes are stored only as hashes (`FieldDevicePairingToken`); plaintext exists only
 * in the one-time admin response and briefly on the officer's device during pairing.
 * Single-use, rate-limited (attemptCount/maxAttempts + the "auth"/"fieldPairing" rate
 * limit policies at the controller layer), and reuses the same challenge/signature
 * infrastructure as tablet-initiated self-registration (FieldDevicesService).
 */
@Injectable()
export class FieldDevicePairingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly devices: FieldDevicesService,
    private readonly devicesAdmin: FieldDevicesAdminService,
    private readonly launcherPolicy: FieldLauncherPolicyService,
  ) {}

  // ---------- Admin-side issuance ----------

  async issuePairingCode(actor: JwtPayload, deviceId: string, dto: IssuePairingCodeDto) {
    return this.issueOrRegenerate(actor, deviceId, dto, "field.device.pairing_issued");
  }

  async regeneratePairing(actor: JwtPayload, deviceId: string, dto: IssuePairingCodeDto) {
    return this.issueOrRegenerate(actor, deviceId, dto, "field.device.pairing_regenerated");
  }

  async regenerateForAuthenticatedDevice(actor: JwtPayload, dto: IssuePairingCodeDto) {
    if (actor.typ !== "field" || !actor.fieldDeviceId) {
      throw new ForbiddenException("Field device session required");
    }
    return this.issueOrRegenerate(
      actor,
      actor.fieldDeviceId,
      dto,
      "field.device.activation_code_regenerated",
      { allowBoundRecovery: true },
    );
  }

  async cancelPairing(actor: JwtPayload, deviceId: string, dto: CancelPairingDto) {
    this.devicesAdmin.assertSupervisor(actor);
    const device = await this.devicesAdmin.requireScopedDevice(deviceId, actor);
    const cancelledCount = await this.revokeActiveTokens(device.id, actor.sub, dto.reason ?? "cancelled_by_admin");

    await this.audit.record({
      actor,
      action: "field.device.pairing_cancelled",
      entityType: "field_device",
      entityId: device.id,
      reason: dto.reason,
      metadata: { publicDeviceId: device.publicDeviceId, cancelledCount },
    });

    return { data: { cancelled: cancelledCount } };
  }

  private async issueOrRegenerate(
    actor: JwtPayload,
    deviceId: string,
    dto: IssuePairingCodeDto,
    auditAction: string,
    options: { allowBoundRecovery?: boolean } = {},
  ) {
    let device;
    if (options.allowBoundRecovery) {
      device = await this.prisma.fieldDevice.findUnique({ where: { id: deviceId } });
      if (!device) throw new NotFoundException("Device not found");
      this.devices.assertDeviceCanAuthenticate(device);
    } else {
      this.devicesAdmin.assertSupervisor(actor);
      device = await this.devicesAdmin.requireScopedDevice(deviceId, actor);
    }
    if (device.provisioningMode !== FieldProvisioningMode.PreProvisioned) {
      throw new BadRequestException("Pairing codes are only issued for pre-provisioned devices");
    }
    if (!device.permissionProfileId) {
      throw new BadRequestException("Assign a permission profile before issuing a pairing code");
    }
    if (!options.allowBoundRecovery && (device.publicKey || device.installationIdHash)) {
      throw new BadRequestException("Device is already bound — use require-re-pair instead");
    }

    const ttlMinutes = this.resolveTtlMinutes(dto.ttlMinutes);
    const token = randomToken(32);
    const shortCode = this.generateShortCode();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await this.withTransaction(async (tx) => {
      await this.lockFieldDevice(tx, device.id);
      const activeCodeCount = await this.countActiveTokens(tx, device.id);
      if (activeCodeCount > 1) {
        await this.deactivateDeviceForDuplicateCodes(tx, device.id, actor, activeCodeCount, device.publicDeviceId);
        throw new ForbiddenException({
          code: FIELD_PAIRING_ERROR_CODES.TOKEN_INVALID,
          message: "Device activation security conflict detected. Administrator review is required.",
        });
      }

      if (activeCodeCount === 1) {
        await this.revokeActiveTokensWithClient(device.id, actor.sub, "superseded", tx);
      }

      await tx.fieldDevicePairingToken.create({
        data: {
          fieldDeviceId: device.id,
          tokenHash: hashToken(token),
          shortCodeHash: hashToken(normalizeFieldPairingShortCode(shortCode)),
          status: FieldPairingTokenStatus.Issued,
          issuedById: actor.sub,
          expiresAt,
          maxAttempts: MAX_CLAIM_ATTEMPTS,
        },
      });

      if (device.preProvisionStatus === FieldPreProvisionStatus.Draft) {
        await tx.fieldDevice.update({
          where: { id: device.id },
          data: { preProvisionStatus: FieldPreProvisionStatus.AwaitingPairing },
        });
      } else if (options.allowBoundRecovery) {
        await tx.fieldDevice.update({
          where: { id: device.id },
          data: { requiresRePair: true },
        });
      }

      const finalActiveCount = await this.countActiveTokens(tx, device.id);
      if (finalActiveCount !== 1) {
        await this.deactivateDeviceForDuplicateCodes(tx, device.id, actor, finalActiveCount, device.publicDeviceId);
        throw new ForbiddenException({
          code: FIELD_PAIRING_ERROR_CODES.TOKEN_INVALID,
          message: "Device activation security conflict detected. Administrator review is required.",
        });
      }
    });

    await this.audit.record({
      actor,
      action: auditAction,
      entityType: "field_device",
      entityId: device.id,
      metadata: { publicDeviceId: device.publicDeviceId, expiresAt: expiresAt.toISOString() },
    });

    return {
      data: {
        publicDeviceId: device.publicDeviceId,
        pairingToken: token,
        shortCode,
        expiresAt: expiresAt.toISOString(),
        qrPayload: JSON.stringify({ v: 1, t: token }),
      },
    };
  }

  private async revokeActiveTokens(fieldDeviceId: string, cancelledById: string, reason: string) {
    return this.revokeActiveTokensWithClient(fieldDeviceId, cancelledById, reason, this.prisma);
  }

  private async revokeActiveTokensWithClient(fieldDeviceId: string, cancelledById: string, reason: string, client: any = this.prisma) {
    const result = await client.fieldDevicePairingToken.updateMany({
      where: { fieldDeviceId, status: { in: [...ACTIVE_PAIRING_STATUSES] } },
      data: { status: FieldPairingTokenStatus.Revoked, cancelledAt: new Date(), cancelledById, revokedReason: reason },
    });
    return result.count;
  }

  private async countActiveTokens(client: any, fieldDeviceId: string) {
    return client.fieldDevicePairingToken.count({
      where: { fieldDeviceId, status: { in: [...ACTIVE_PAIRING_STATUSES] } },
    });
  }

  private async lockFieldDevice(client: any, fieldDeviceId: string) {
    if (typeof client.$queryRawUnsafe !== "function") return;
    await client.$queryRawUnsafe('SELECT "id" FROM "field_devices" WHERE "id" = $1::uuid FOR UPDATE', fieldDeviceId);
  }

  private async deactivateDeviceForDuplicateCodes(
    client: any,
    fieldDeviceId: string,
    actor: JwtPayload,
    activeCodeCount: number,
    publicDeviceId?: string,
  ) {
    const now = new Date();
    await client.fieldDevice.update({
      where: { id: fieldDeviceId },
      data: {
        registrationStatus: FieldDeviceRegistrationStatus.Deactivated,
        deactivationReason: DUPLICATE_ACTIVE_CODE_REASON,
        securityDeactivatedAt: now,
        requiresRePair: true,
        tokenVersion: { increment: 1 },
      } as never,
    });
    await client.fieldDevicePairingToken.updateMany({
      where: { fieldDeviceId, status: { in: [...ACTIVE_PAIRING_STATUSES] } },
      data: {
        status: FieldPairingTokenStatus.Revoked,
        cancelledAt: now,
        revokedReason: DUPLICATE_ACTIVE_CODE_REASON,
      },
    });
    await client.fieldDeviceSession.updateMany?.({
      where: { fieldDeviceId, revokedAt: null },
      data: { revokedAt: now },
    });
    await client.auditLog.create?.({
      data: {
        actorType: "system",
        action: "DEVICE_DUPLICATE_ACTIVE_CODE_DETECTED",
        entityType: "field_device",
        entityId: fieldDeviceId,
        reason: DUPLICATE_ACTIVE_CODE_REASON,
        metadata: {
          deviceType: "field_tablet",
          publicDeviceId,
          actorId: actor.sub,
          activeCodeCount,
          result: "DEVICE_DEACTIVATED_ALL_CODES_REVOKED",
        },
      } as never,
    });
  }

  private async withTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    if (typeof (this.prisma as any).$transaction !== "function") {
      return callback(this.prisma as any);
    }
    return (this.prisma as any).$transaction(callback);
  }

  private resolveTtlMinutes(requested?: number) {
    if (requested == null) return DEFAULT_PAIRING_TTL_MINUTES;
    if (!Number.isFinite(requested) || requested < MIN_PAIRING_TTL_MINUTES || requested > MAX_PAIRING_TTL_MINUTES) {
      throw new BadRequestException(`ttlMinutes must be between ${MIN_PAIRING_TTL_MINUTES} and ${MAX_PAIRING_TTL_MINUTES}`);
    }
    return requested;
  }

  private generateShortCode(): string {
    let raw = "";
    for (let i = 0; i < 8; i += 1) {
      raw += FIELD_PAIRING_SHORT_CODE_ALPHABET[randomInt(0, FIELD_PAIRING_SHORT_CODE_ALPHABET.length)];
    }
    return formatFieldPairingShortCode(raw);
  }

  // ---------- Field-side claim / challenge / complete ----------

  async claim(dto: ClaimFieldPairingDto) {
    const token = await this.findToken(dto);
    await this.assertSingleActiveTokenOrDeactivate(token.fieldDeviceId);
    this.assertTokenClaimable(token);

    if (token.status === FieldPairingTokenStatus.Issued) {
      await this.prisma.fieldDevicePairingToken.update({
        where: { id: token.id },
        data: { status: FieldPairingTokenStatus.Claimed, claimedAt: new Date() },
      });
    }

    const device = await this.prisma.fieldDevice.findUnique({ where: { id: token.fieldDeviceId } });
    if (!device) throw new NotFoundException("Device not found");

    return {
      data: {
        publicDeviceId: device.publicDeviceId,
        deviceName: device.deviceName,
        operationalRole: device.operationalRole,
        expiresAt: token.expiresAt.toISOString(),
      },
    };
  }

  async challenge(dto: FieldPairingChallengeDto) {
    const token = await this.findToken(dto);
    await this.assertSingleActiveTokenOrDeactivate(token.fieldDeviceId);
    this.assertTokenClaimable(token);
    if (token.status !== FieldPairingTokenStatus.Claimed) {
      throw new ForbiddenException({
        code: FIELD_PAIRING_ERROR_CODES.TOKEN_INVALID,
        message: "Claim the pairing code before requesting a challenge",
      });
    }
    return this.devices.createRegistrationChallenge();
  }

  async complete(dto: CompleteFieldPairingClaimDto) {
    const token = await this.findToken(dto);
    await this.assertSingleActiveTokenOrDeactivate(token.fieldDeviceId);
    this.assertTokenClaimable(token);
    if (token.status !== FieldPairingTokenStatus.Claimed) {
      throw new ForbiddenException({
        code: FIELD_PAIRING_ERROR_CODES.TOKEN_INVALID,
        message: "Claim the pairing code before completing pairing",
      });
    }
    if (!dto.publicKey || !dto.installationIdHash || !dto.challengeId || !dto.challenge || !dto.challengeSignature) {
      throw new BadRequestException("publicKey, installationIdHash, and challenge fields are required");
    }

    try {
      await this.devices.consumeChallenge(dto.challengeId, dto.challenge);
    } catch (error) {
      await this.registerFailedAttempt(token.id);
      throw error;
    }

    if (!verifyFieldDeviceSignature(dto.publicKey, dto.challenge, dto.challengeSignature)) {
      await this.registerFailedAttempt(token.id);
      throw new UnauthorizedException({ code: FIELD_ERROR_CODES.DEVICE_SIGNATURE_INVALID, message: "Device signature invalid" });
    }

    const existingBinding = await this.prisma.fieldDevice.findUnique({ where: { installationIdHash: dto.installationIdHash } });
    if (existingBinding && existingBinding.id !== token.fieldDeviceId) {
      throw new ForbiddenException({
        code: FIELD_PAIRING_ERROR_CODES.DEVICE_ALREADY_BOUND,
        message: "This installation is already bound to another device",
      });
    }

    const device = await this.prisma.fieldDevice.findUnique({ where: { id: token.fieldDeviceId } });
    if (!device) throw new NotFoundException("Device not found");
    if ((device.publicKey || device.installationIdHash) && !device.requiresRePair) {
      throw new ForbiddenException({ code: FIELD_PAIRING_ERROR_CODES.DEVICE_ALREADY_BOUND, message: "Device already bound" });
    }

    const activationPolicy = device.activationPolicy ?? FieldActivationPolicy.RequireSupervisorFinalApproval;
    const autoActivate = activationPolicy === FieldActivationPolicy.AutoActivateOnPairing;
    const now = new Date();
    const authoritySnapshot = (device.authoritySnapshot as Record<string, unknown> | null) ?? {};

    const updatedDevice = await this.prisma.fieldDevice.update({
      where: { id: device.id },
      data: {
        publicKey: dto.publicKey,
        installationIdHash: dto.installationIdHash,
        serialHash: dto.serialHash ?? device.serialHash,
        deviceName: dto.deviceName?.trim() || device.deviceName,
        manufacturer: dto.manufacturer ?? device.manufacturer,
        model: dto.model ?? device.model,
        androidVersion: dto.androidVersion ?? device.androidVersion,
        appVersion: dto.appVersion ?? device.appVersion,
        buildNumber: dto.buildNumber ?? device.buildNumber,
        packageName: dto.packageName ?? device.packageName,
        appEnvironment: dto.appEnvironment ?? device.appEnvironment,
        requiresRePair: false,
        lastAuthenticatedAt: now,
        preProvisionStatus: autoActivate ? FieldPreProvisionStatus.Active : FieldPreProvisionStatus.AwaitingFinalApproval,
        registrationStatus: autoActivate ? FieldDeviceRegistrationStatus.Active : device.registrationStatus,
        approvedAt: autoActivate ? now : device.approvedAt,
        approvedById: autoActivate ? token.issuedById : device.approvedById,
        authoritySnapshot: { ...authoritySnapshot, boundAt: now.toISOString() } as never,
      },
    });

    await this.prisma.fieldDevicePairingToken.update({
      where: { id: token.id },
      data: { status: FieldPairingTokenStatus.Completed, completedAt: now },
    });

    if (device.operationalRole) {
      await this.launcherPolicy.applyPairingDefaults(device.id, device.operationalRole, device.deviceMode ?? undefined);
    }

    await this.audit.record({
      actor: { sub: token.issuedById, typ: "admin", permissions: [] },
      action: "field.device.pairing_claim_completed",
      entityType: "field_device",
      entityId: device.id,
      metadata: {
        publicDeviceId: device.publicDeviceId,
        autoActivated: autoActivate,
        requiresFinalApproval: !autoActivate,
      },
    });

    return {
      data: {
        publicDeviceId: updatedDevice.publicDeviceId,
        registrationStatus: updatedDevice.registrationStatus,
        preProvisionStatus: updatedDevice.preProvisionStatus,
        requiresFinalApproval: !autoActivate,
      },
    };
  }

  async status(query: FieldPairingStatusQuery) {
    const token = await this.findToken(query);
    await this.assertSingleActiveTokenOrDeactivate(token.fieldDeviceId);
    return {
      data: {
        status: token.status,
        expiresAt: token.expiresAt.toISOString(),
        attemptsRemaining: Math.max(0, token.maxAttempts - token.attemptCount),
      },
    };
  }

  private async findToken(input: { pairingToken?: string; shortCode?: string }): Promise<PairingTokenRow> {
    if (!input.pairingToken && !input.shortCode) {
      throw new BadRequestException("pairingToken or shortCode is required");
    }
    const tokenHash = input.pairingToken ? hashToken(input.pairingToken) : undefined;
    const shortCodeHash = input.shortCode ? hashToken(normalizeFieldPairingShortCode(input.shortCode)) : undefined;

    const token = await this.prisma.fieldDevicePairingToken.findFirst({
      where: tokenHash ? { tokenHash } : { shortCodeHash },
    });
    if (!token) {
      throw new UnauthorizedException({ code: FIELD_PAIRING_ERROR_CODES.TOKEN_INVALID, message: "Invalid pairing code" });
    }
    return token;
  }

  private async assertSingleActiveTokenOrDeactivate(fieldDeviceId: string) {
    const activeCodeCount = await this.countActiveTokens(this.prisma, fieldDeviceId);
    if (activeCodeCount <= 1) return;
    const device = await this.prisma.fieldDevice.findUnique({ where: { id: fieldDeviceId } });
    await this.deactivateDeviceForDuplicateCodes(
      this.prisma,
      fieldDeviceId,
      { sub: "system", typ: "admin", permissions: [] } as never,
      activeCodeCount,
      device?.publicDeviceId,
    );
    throw new ForbiddenException({
      code: FIELD_PAIRING_ERROR_CODES.TOKEN_INVALID,
      message: "Device activation security conflict detected. Administrator review is required.",
    });
  }

  private assertTokenClaimable(token: PairingTokenRow) {
    if (token.status === FieldPairingTokenStatus.Completed) {
      throw new ForbiddenException({ code: FIELD_PAIRING_ERROR_CODES.TOKEN_ALREADY_USED, message: "Pairing code already used" });
    }
    if (token.status === FieldPairingTokenStatus.Revoked || token.status === FieldPairingTokenStatus.Failed) {
      throw new ForbiddenException({ code: FIELD_PAIRING_ERROR_CODES.TOKEN_INVALID, message: "Pairing code no longer valid" });
    }
    if (token.expiresAt.getTime() <= Date.now()) {
      throw new ForbiddenException({ code: FIELD_PAIRING_ERROR_CODES.TOKEN_EXPIRED, message: "Pairing code expired" });
    }
    if (token.attemptCount >= token.maxAttempts) {
      throw new ForbiddenException({ code: FIELD_PAIRING_ERROR_CODES.RATE_LIMITED, message: "Too many attempts — request a new pairing code" });
    }
  }

  private async registerFailedAttempt(tokenId: string) {
    const updated = await this.prisma.fieldDevicePairingToken.update({
      where: { id: tokenId },
      data: { attemptCount: { increment: 1 } },
    });
    if (updated.attemptCount >= updated.maxAttempts) {
      await this.prisma.fieldDevicePairingToken.update({
        where: { id: tokenId },
        data: { status: FieldPairingTokenStatus.Failed },
      });
    }
  }
}
