import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException, BadRequestException, Optional, ConflictException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomInt } from "crypto";
import {
  AdminRoleName,
  EmergencyCategory,
  IncidentPriority,
  IncidentType,
  SmartwatchPairingMethod,
  WatchAssignmentStatus,
  WatchInventoryStatus,
  WatchOwnerType,
  WatchOwnershipStatus,
  WATCH_OWNERSHIP_BLOCKED_STATUSES,
} from "@the-eye/shared";
import { randomToken, hashToken } from "../../common/auth/crypto";
import { signJwt, parseTtl, type JwtPayload } from "../../common/auth/jwt";
import { requireJwtAccessSecret } from "../../common/auth/jwt-secrets";
import { adminCanAccessGeography } from "../../common/auth/admin-geography-scope";
import { AuditService } from "../audit/audit.service";
import { IncidentsService } from "../incidents/incidents.service";
import { NotificationsService } from "../notifications/notifications.service";
import { resolveAppEnvironment } from "../../common/auth/firebase-environment";
import { PrismaService } from "../prisma/prisma.service";
import {
  RegisterSmartwatchDeviceDto,
  SendCriticalAlertDto,
  SmartwatchFirmwareReleaseDto,
  SmartwatchGpsDto,
  SmartwatchHeartbeatDto,
  SmartwatchOfflineSyncDto,
  SmartwatchSosDto,
  SmartwatchStandaloneLoginDto,
  ActivateWatchWithCodeDto,
  RegenerateWatchActivationCodeDto,
  validateActivateWatchWithCodeDto,
  normalizeWatchPairingCode,
  WatchAccessibilityPreferencesDto,
  UpdateSmartwatchStatusDto,
  IssueSmartwatchPairingCodeDto,
  AdminIssueSmartwatchActivationDto,
  validateAdminIssueActivationDto,
  validateCriticalAlertDto,
  validateFirmwareReleaseDto,
  validateHeartbeatDto,
  validateIssuePairingCodeDto,
  validateOfflineSyncDto,
  validateRegisterSmartwatchDeviceDto,
  validateRegenerateWatchActivationCodeDto,
  validateStandaloneLoginDto,
  validateSmartwatchGpsDto,
  validateSmartwatchSosDto,
  validateSmartwatchStatusDto,
} from "./dto/smartwatch.dto";
import { DangerZoneTargetingService } from "../danger-zones/danger-zone-targeting.service";
import { DangerZonesService } from "../danger-zones/danger-zones.service";
import {
  mergeWatchAccessibilityPreferences,
  readAccessibilityPreferencesFromMetadata,
  writeAccessibilityPreferencesToMetadata,
} from "./watch-accessibility-preferences";

const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;
const WATCH_ACTIVATION_STATUS_ACTIVE = "ACTIVE";
const WATCH_ACTIVATION_STATUS_USED = "USED";
const WATCH_ACTIVATION_STATUS_REVOKED = "REVOKED";
const ACTIVATION_STATUS_USABLE = "USABLE";
const ACTIVATION_STATUS_LOCKED = "LOCKED";
const MAX_FAILED_ACTIVATION_ATTEMPTS = 3;
const BRUTE_FORCE_LOCK_REASON = "TOO_MANY_FAILED_ACTIVATION_ATTEMPTS";
const BRUTE_FORCE_LOCK_EVENT = "DEVICE_ACTIVATION_BRUTE_FORCE_LOCKED";
const WATCH_SECURITY_DEACTIVATION_REASON = "DUPLICATE_ACTIVE_ACTIVATION_CODES";

@Injectable()
export class SmartwatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly incidents: IncidentsService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
    @Optional() private readonly dangerZoneTargeting?: DangerZoneTargetingService,
    @Optional() private readonly dangerZones?: DangerZonesService,
  ) {}

  async registerDevice(dto: RegisterSmartwatchDeviceDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can pair smartwatch devices");
    validateRegisterSmartwatchDeviceDto(dto);
    await this.assertValidPairingCode(dto);

    const existing = await this.prisma.smartwatchDevice.findUnique({ where: { deviceId: dto.deviceId } });
    if (existing) {
      if (WATCH_OWNERSHIP_BLOCKED_STATUSES.includes(existing.ownershipStatus as never)) {
        throw new ConflictException(`Device is ${existing.ownershipStatus} and cannot be paired`);
      }
      if (
        existing.currentAssigneeId &&
        existing.currentAssigneeId !== actor.sub &&
        existing.userId &&
        existing.userId !== actor.sub
      ) {
        throw new ConflictException("Device is assigned to another person; authorized transfer required");
      }
    }

    const deviceSecret = randomToken(32);
    const now = new Date();
    const ownershipFields = {
      currentOwnerType: WatchOwnerType.Person,
      currentOwnerId: actor.sub,
      currentAssigneeId: actor.sub,
      ownershipStatus: WatchOwnershipStatus.PersonOwned,
      assignmentStatus: WatchAssignmentStatus.Assigned,
      inventoryStatus: WatchInventoryStatus.Deployed,
    };

    const device = await this.prisma.smartwatchDevice.upsert({
      where: { deviceId: dto.deviceId },
      update: {
        userId: actor.sub,
        serialNumber: dto.serialNumber,
        imei: dto.imei,
        eid: dto.eid,
        simNumber: dto.simNumber,
        provider: dto.provider,
        displayName: dto.displayName,
        model: dto.model,
        connectivityMode: dto.connectivityMode ?? "PairedPhone",
        preferredMode: dto.preferredMode ?? dto.connectivityMode ?? "PairedPhone",
        pairingMethod: dto.pairingMethod ?? "PairingCode",
        pairingCodeHash: dto.pairingCode ? hashToken(dto.pairingCode) : undefined,
        failoverEnabled: dto.failoverEnabled ?? true,
        pairedPhoneDeviceId: dto.pairedPhoneDeviceId,
        cellularProvider: dto.cellularProvider,
        phoneNumber: dto.phoneNumber,
        firmwareVersion: dto.firmwareVersion,
        deviceCertificate: dto.deviceCertificate,
        publicKey: dto.publicKey,
        criticalAlertsEnabled: dto.criticalAlertsEnabled ?? true,
        isActive: true,
        deviceSecretHash: hashToken(deviceSecret),
        metadata: dto.metadata ?? {},
        ...ownershipFields,
      } as never,
      create: {
        userId: actor.sub,
        deviceId: dto.deviceId,
        serialNumber: dto.serialNumber,
        imei: dto.imei,
        eid: dto.eid,
        simNumber: dto.simNumber,
        provider: dto.provider,
        displayName: dto.displayName,
        model: dto.model,
        connectivityMode: dto.connectivityMode ?? "PairedPhone",
        preferredMode: dto.preferredMode ?? dto.connectivityMode ?? "PairedPhone",
        pairingMethod: dto.pairingMethod ?? "PairingCode",
        pairingCodeHash: dto.pairingCode ? hashToken(dto.pairingCode) : undefined,
        failoverEnabled: dto.failoverEnabled ?? true,
        pairedPhoneDeviceId: dto.pairedPhoneDeviceId,
        cellularProvider: dto.cellularProvider,
        phoneNumber: dto.phoneNumber,
        firmwareVersion: dto.firmwareVersion,
        deviceCertificate: dto.deviceCertificate,
        publicKey: dto.publicKey,
        criticalAlertsEnabled: dto.criticalAlertsEnabled ?? true,
        deviceSecretHash: hashToken(deviceSecret),
        metadata: dto.metadata ?? {},
        ...ownershipFields,
      } as never,
    });

    if (!existing) {
      await (this.prisma as any).watchOwnershipRecord.create({
        data: {
          deviceId: device.id,
          ownerType: WatchOwnerType.Person,
          ownerPersonId: actor.sub,
          ownershipStatus: WatchOwnershipStatus.PersonOwned,
          validFrom: now,
          correlationId: `pair-${device.id}-${now.getTime()}`,
        },
      });
      await (this.prisma as any).watchAssignmentRecord.create({
        data: {
          deviceId: device.id,
          assigneePersonId: actor.sub,
          assignmentStatus: WatchAssignmentStatus.Assigned,
          validFrom: now,
          assignedAt: now,
          correlationId: `pair-${device.id}-${now.getTime()}`,
        },
      });
    }

    await (this.prisma as any).watchPairingHistoryRecord.create({
      data: {
        deviceId: device.id,
        ownerTypeAtPairing: device.currentOwnerType,
        ownerIdAtPairing: device.currentOwnerId,
        assigneeIdAtPairing: device.currentAssigneeId,
        pairedUserId: actor.sub,
        pairedAt: now,
        pairingMethod: dto.pairingMethod ?? SmartwatchPairingMethod.PairingCode,
        pairingCodeRef: dto.pairingCode ? hashToken(dto.pairingCode).slice(0, 12) : null,
        pairingStatus: "PAIRED",
        authenticationStatus: "AUTHENTICATED",
        lastSuccessfulAuthAt: now,
        correlationId: `pair-${device.id}-${now.getTime()}`,
      },
    });

    await this.audit(actor, "smartwatch.device_paired", "smartwatch_devices", device.id, { deviceId: dto.deviceId, connectivityMode: dto.connectivityMode ?? "PairedPhone" });
    await this.completePairingSession(dto.deviceId, deviceSecret);
    return { data: device, deviceSecret };
  }

  async issuePairingCode(dto: IssueSmartwatchPairingCodeDto) {
    validateIssuePairingCodeDto(dto);
    const firebaseEnv = dto.firebaseEnv ?? this.defaultFirebaseEnv();
    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
    const existing = await (this.prisma as any).smartwatchPairingSession.findUnique({ where: { deviceId: dto.deviceId } });
    if (existing?.activationStatus === ACTIVATION_STATUS_LOCKED) {
      throw this.genericActivationFailure();
    }
    const session = await (this.prisma as any).smartwatchPairingSession.upsert({
      where: { deviceId: dto.deviceId },
      update: {
        pairingCodeHash: hashToken(dto.pairingCode),
        status: WATCH_ACTIVATION_STATUS_ACTIVE,
        failedActivationAttempts: 0,
        firstFailedActivationAt: null,
        lastFailedActivationAt: null,
        activationStatus: ACTIVATION_STATUS_USABLE,
        activationLockedAt: null,
        activationLockReason: null,
        firebaseEnv,
        expiresAt,
        usedAt: null,
        deviceSecretPlain: null,
      },
      create: {
        deviceId: dto.deviceId,
        pairingCodeHash: hashToken(dto.pairingCode),
        status: WATCH_ACTIVATION_STATUS_ACTIVE,
        firebaseEnv,
        expiresAt,
      },
    });

    await this.recordDeviceAudit({
      action: "smartwatch.pairing_code_issued",
      entityType: "smartwatch_pairing_sessions",
      entityId: session.id,
      metadata: { deviceId: dto.deviceId, firebaseEnv, expiresAt: expiresAt.toISOString() },
    });

    return { data: { deviceId: dto.deviceId, expiresAt: expiresAt.toISOString(), status: "pending" } };
  }

  async getPairingStatus(deviceId: string) {
    const session = await (this.prisma as any).smartwatchPairingSession.findUnique({ where: { deviceId } });
    if (!session) return { data: { status: "not_found" } };
    if ((session as any).activationStatus === ACTIVATION_STATUS_LOCKED) {
      return { data: { status: "locked" } };
    }
    if ((session as any).status === WATCH_ACTIVATION_STATUS_REVOKED) {
      return { data: { status: "revoked" } };
    }
    if (session.usedAt && session.deviceSecretPlain) {
      const secret = session.deviceSecretPlain as string;
      await (this.prisma as any).smartwatchPairingSession.update({
        where: { deviceId },
        data: { deviceSecretPlain: null },
      });
      return { data: { status: "paired", deviceSecret: secret } };
    }
    if (session.usedAt || (session as any).status === WATCH_ACTIVATION_STATUS_USED) return { data: { status: "paired" } };
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      return { data: { status: "expired" } };
    }
    return { data: { status: "pending", expiresAt: session.expiresAt } };
  }

  async regenerateActivationCode(deviceLookup: string, dto: RegenerateWatchActivationCodeDto, actor?: JwtPayload) {
    validateRegenerateWatchActivationCodeDto(dto);
    const device = await this.findAuthorizedDevice(deviceLookup, dto.deviceSecret, actor);
    if ((device as any).securityDeactivatedAt || (device as any).deactivationReason === WATCH_SECURITY_DEACTIVATION_REASON) {
      throw new ForbiddenException("Device security verification required");
    }
    const existingSession = await (this.prisma as any).smartwatchPairingSession.findUnique({ where: { deviceId: device.deviceId } });
    if (existingSession?.activationStatus === ACTIVATION_STATUS_LOCKED) {
      throw this.genericActivationFailure();
    }
    const firebaseEnv = dto.firebaseEnv ?? this.defaultFirebaseEnv();
    const pairingCode = this.generateSixDigitCode();
    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
    const session = await (this.prisma as any).smartwatchPairingSession.upsert({
      where: { deviceId: device.deviceId },
      update: {
        pairingCodeHash: hashToken(pairingCode),
        status: WATCH_ACTIVATION_STATUS_ACTIVE,
        failedActivationAttempts: 0,
        firstFailedActivationAt: null,
        lastFailedActivationAt: null,
        activationStatus: ACTIVATION_STATUS_USABLE,
        activationLockedAt: null,
        activationLockReason: null,
        firebaseEnv,
        expiresAt,
        usedAt: null,
        deviceSecretPlain: null,
      },
      create: {
        deviceId: device.deviceId,
        pairingCodeHash: hashToken(pairingCode),
        status: WATCH_ACTIVATION_STATUS_ACTIVE,
        firebaseEnv,
        expiresAt,
      },
    });
    await this.recordDeviceAudit({
      action: "DEVICE_ACTIVATION_CODE_REGENERATED",
      entityType: "smartwatch_pairing_sessions",
      entityId: session.id,
      actorUserId: device.userId ?? undefined,
      metadata: { deviceId: device.deviceId, firebaseEnv, expiresAt: expiresAt.toISOString() },
    });
    return {
      data: {
        deviceId: device.deviceId,
        activationCode: pairingCode,
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  async standaloneLogin(dto: SmartwatchStandaloneLoginDto) {
    validateStandaloneLoginDto(dto);
    const device = await this.findAuthorizedDevice(dto.deviceId, dto.deviceSecret);
    if ((device as any).remoteDisabledAt || (device as any).remoteWipedAt) throw new ForbiddenException("Device has been remotely disabled");
    if (dto.deviceCertificate && (device as any).deviceCertificate && dto.deviceCertificate !== (device as any).deviceCertificate) throw new UnauthorizedException("Device certificate mismatch");

    await this.prisma.smartwatchDevice.update({
      where: { id: device.id },
      data: { connectivityMode: "StandaloneCellular", isOnline: true, lastSeenAt: new Date() } as never,
    });

    const token = signJwt({
      sub: device.userId,
      typ: "user",
      permissions: ["incident:create", "incident:read"],
      deviceId: device.id,
      deviceSerialNumber: (device as any).serialNumber,
      authMode: "standalone_watch",
    } as any, requireJwtAccessSecret(this.config), this.config.get<string>("JWT_ACCESS_TTL", "15m"));

    await this.recordDeviceAudit({
      action: "smartwatch.standalone_login",
      entityType: "smartwatch_devices",
      entityId: device.id,
      actorUserId: device.userId ?? undefined,
      metadata: { deviceId: device.deviceId },
    });
    return { accessToken: token, tokenType: "Bearer", mode: "StandaloneCellular", expiresInSeconds: 900 };
  }

  async activateWithCode(dto: ActivateWatchWithCodeDto) {
    validateActivateWatchWithCodeDto(dto);
    const pairingCode = normalizeWatchPairingCode(dto.pairingCode);
    const correlationId = dto.correlationId ?? `watch-activate-${dto.deviceId}-${Date.now()}`;
    const firebaseEnv = dto.firebaseEnv ?? this.defaultFirebaseEnv();

    const session = await (this.prisma as any).smartwatchPairingSession.findUnique({
      where: { deviceId: dto.deviceId },
    });
    if (!session) {
      throw this.genericActivationFailure();
    }
    if ((session as any).activationStatus === ACTIVATION_STATUS_LOCKED) {
      throw this.genericActivationFailure();
    }
    const pairingCodeHash = hashToken(pairingCode);
    const sessionExpired = new Date(session.expiresAt).getTime() < Date.now();
    const codeMatches = session.pairingCodeHash === pairingCodeHash;

    if (session.usedAt && session.deviceSecretPlain && codeMatches && !sessionExpired) {
      return this.buildActivateWithCodeRecoveryResponse(dto, session, pairingCode, correlationId, firebaseEnv);
    }
    if (session.usedAt && session.deviceSecretPlain) {
      throw this.genericActivationFailure();
    }
    if (session.usedAt) {
      throw this.genericActivationFailure();
    }
    if (sessionExpired) {
      throw this.genericActivationFailure();
    }
    if (session.firebaseEnv !== firebaseEnv) {
      throw this.genericActivationFailure();
    }
    if (!codeMatches) {
      await this.registerWatchFailedActivationAttempt(dto.deviceId, session);
      throw this.genericActivationFailure();
    }

    const deviceSecret = randomToken(32);
    const now = new Date();
    const ttl = this.config.get<string>("JWT_ACCESS_TTL", "15m");

    let device;
    try {
      device = await this.prisma.smartwatchDevice.upsert({
        where: { deviceId: dto.deviceId },
        update: {
        deviceSecretHash: hashToken(deviceSecret),
          connectivityMode: "StandaloneCellular",
          preferredMode: "StandaloneCellular",
          pairingMethod: SmartwatchPairingMethod.PairingCode,
          isActive: true,
          isOnline: true,
          lastSeenAt: now,
          appVersion: dto.appVersion,
          model: dto.model,
          manufacturer: dto.manufacturer,
          assignmentStatus: "ASSIGNED",
          inventoryStatus: "DEPLOYED",
        } as never,
        create: {
          deviceId: dto.deviceId,
          provider: "THE_EYE",
          deviceSecretHash: hashToken(deviceSecret),
          connectivityMode: "StandaloneCellular",
          preferredMode: "StandaloneCellular",
          pairingMethod: SmartwatchPairingMethod.PairingCode,
          isActive: true,
          isOnline: true,
          lastSeenAt: now,
          appVersion: dto.appVersion,
          model: dto.model,
          manufacturer: dto.manufacturer,
          ownershipStatus: "UNASSIGNED_INVENTORY",
          assignmentStatus: "UNASSIGNED",
          inventoryStatus: "IN_STOCK",
          currentOwnerType: "UNASSIGNED_INVENTORY",
        } as never,
      });
    } catch (error) {
      if (isStandaloneActivationSchemaError(error)) {
        throw new ServiceUnavailableException(
          "Standalone watch activation requires database migration 20260731120000_watch_ownership_fleet on the staging API server.",
        );
      }
      throw error;
    }

    const subjectUserId =
      device.userId ??
      (device as any).currentAssigneeId ??
      ((device as any).currentOwnerType === "PERSON" ? (device as any).currentOwnerId : null) ??
      device.id;

    const expiresInSeconds = parseTtl(ttl, 900);
    const token = signJwt(
      {
        sub: subjectUserId,
        typ: "user",
        permissions: ["incident:create", "incident:read"],
        deviceId: device.id,
        deviceSerialNumber: (device as any).serialNumber,
        authMode: "standalone_watch",
      } as any,
      requireJwtAccessSecret(this.config),
      ttl,
    );

    await (this.prisma as any).smartwatchPairingSession.update({
      where: { deviceId: dto.deviceId },
      data: {
        usedAt: now,
        status: WATCH_ACTIVATION_STATUS_USED,
        failedActivationAttempts: 0,
        firstFailedActivationAt: null,
        lastFailedActivationAt: null,
        activationStatus: ACTIVATION_STATUS_USABLE,
        activationLockedAt: null,
        activationLockReason: null,
        deviceSecretPlain: deviceSecret,
      },
    });

    try {
      await (this.prisma as any).watchPairingHistoryRecord.create({
        data: {
          deviceId: device.id,
          ownerTypeAtPairing: (device as any).currentOwnerType,
          ownerIdAtPairing: (device as any).currentOwnerId,
          assigneeIdAtPairing: (device as any).currentAssigneeId,
          pairedAt: now,
          pairingMethod: SmartwatchPairingMethod.PairingCode,
          pairingCodeRef: hashToken(pairingCode).slice(0, 12),
          pairingStatus: "ACTIVATED",
          authenticationStatus: "AUTHENTICATED",
          lastSuccessfulAuthAt: now,
          correlationId,
        },
      });
    } catch {
      // Pairing history table may be unavailable on older schema deployments.
    }

    await this.recordDeviceAudit({
      action: "smartwatch.device_activated_with_code",
      entityType: "smartwatch_devices",
      entityId: device.id,
      actorUserId: device.userId ?? undefined,
      metadata: { deviceId: dto.deviceId, correlationId, firebaseEnv },
    });

    const ownerType = (device as any).currentOwnerType ?? "UNASSIGNED_INVENTORY";
    const ownerId = (device as any).currentOwnerId ?? (device as any).currentAssigneeId ?? null;

    return {
      status: "activated",
      correlationId,
      watch: {
        id: device.id,
        deviceId: device.deviceId,
        pairingStatus: "ACTIVE",
      },
      owner: ownerId
        ? {
            id: ownerId,
            type: ownerType === "ORGANIZATION" ? "ORGANIZATION" : "PERSON",
          }
        : null,
      authentication: {
        accessToken: token,
        refreshToken: null,
        expiresAt: new Date(now.getTime() + expiresInSeconds * 1000).toISOString(),
        tokenType: "Bearer",
        mode: "StandaloneCellular",
        expiresInSeconds,
      },
      deviceSecret,
    };
  }

  private async buildActivateWithCodeRecoveryResponse(
    dto: ActivateWatchWithCodeDto,
    session: { deviceSecretPlain: string },
    pairingCode: string,
    correlationId: string,
    firebaseEnv: string,
  ) {
    const deviceSecret = session.deviceSecretPlain;
    const device = await this.prisma.smartwatchDevice.findUnique({
      where: { deviceId: dto.deviceId },
    });
    if (!device) {
      throw new ConflictException("Activation code already consumed");
    }

    const now = new Date();
    const ttl = this.config.get<string>("JWT_ACCESS_TTL", "15m");
    const subjectUserId =
      device.userId ??
      (device as any).currentAssigneeId ??
      ((device as any).currentOwnerType === "PERSON" ? (device as any).currentOwnerId : null) ??
      device.id;
    const expiresInSeconds = parseTtl(ttl, 900);
    const token = signJwt(
      {
        sub: subjectUserId,
        typ: "user",
        permissions: ["incident:create", "incident:read"],
        deviceId: device.id,
        deviceSerialNumber: (device as any).serialNumber,
        authMode: "standalone_watch",
      } as any,
      requireJwtAccessSecret(this.config),
      ttl,
    );

    await this.recordDeviceAudit({
      action: "smartwatch.device_activation_recovery",
      entityType: "smartwatch_devices",
      entityId: device.id,
      actorUserId: device.userId ?? undefined,
      metadata: { deviceId: dto.deviceId, correlationId, firebaseEnv },
    });

    const ownerType = (device as any).currentOwnerType ?? "UNASSIGNED_INVENTORY";
    const ownerId = (device as any).currentOwnerId ?? (device as any).currentAssigneeId ?? null;

    return {
      status: "activated",
      correlationId,
      recovery: true,
      watch: {
        id: device.id,
        deviceId: device.deviceId,
        pairingStatus: "ACTIVE",
      },
      owner: ownerId
        ? {
            id: ownerId,
            type: ownerType === "ORGANIZATION" ? "ORGANIZATION" : "PERSON",
          }
        : null,
      authentication: {
        accessToken: token,
        refreshToken: null,
        expiresAt: new Date(now.getTime() + expiresInSeconds * 1000).toISOString(),
        tokenType: "Bearer",
        mode: "StandaloneCellular",
        expiresInSeconds,
      },
      deviceSecret,
    };
  }

  async listMyDevices(actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can list personal smartwatch devices");
    return {
      data: await this.prisma.smartwatchDevice.findMany({
        where: { userId: actor.sub },
        orderBy: { createdAt: "desc" },
      }),
    };
  }

  async updateDeviceStatus(id: string, dto: UpdateSmartwatchStatusDto, actor: JwtPayload) {
    validateSmartwatchStatusDto(dto);
    const device = await this.prisma.smartwatchDevice.findUnique({
      where: { id },
      include: { user: { include: { profile: true } }, currentOrganization: true, currentInventoryLocation: true },
    });
    if (!device) throw new NotFoundException("Smartwatch device not found");
    if (actor.typ === "user" && device.userId !== actor.sub) throw new ForbiddenException("You can only update your own smartwatch devices");
    if (actor.typ === "admin") this.assertAdminCanAccessDevice(device, actor);

    const updated = await this.prisma.smartwatchDevice.update({
      where: { id },
      data: {
        connectivityMode: dto.connectivityMode,
        preferredMode: dto.preferredMode,
        batteryLevel: dto.batteryLevel,
        signalStrength: dto.signalStrength,
        firmwareVersion: dto.firmwareVersion,
        firmwareSignatureStatus: dto.firmwareSignatureStatus,
        criticalAlertsEnabled: dto.criticalAlertsEnabled,
        failoverEnabled: dto.failoverEnabled,
        isActive: dto.isActive,
        isOnline: dto.isOnline,
        lastSeenAt: dto.lastSeenAt ? new Date(dto.lastSeenAt) : new Date(),
        metadata: dto.metadata,
      } as never,
    });

    await this.audit(actor, "smartwatch.device_status_updated", "smartwatch_devices", id, { batteryLevel: dto.batteryLevel, connectivityMode: dto.connectivityMode });
    return { data: updated };
  }

  async unpairDevice(id: string, actor: JwtPayload) {
    const device = await this.prisma.smartwatchDevice.findUnique({
      where: { id },
      include: { user: { include: { profile: true } }, currentOrganization: true, currentInventoryLocation: true },
    });
    if (!device) throw new NotFoundException("Smartwatch device not found");
    if (actor.typ === "user" && device.userId !== actor.sub) throw new ForbiddenException("You can only remove your own smartwatch devices");
    if (actor.typ === "admin") this.assertAdminCanAccessDevice(device, actor);
    if (device.userId) {
      await this.notifications.deactivatePushTokensForDevice(device.userId, device.deviceId);
    }
    const updated = await this.prisma.smartwatchDevice.update({
      where: { id },
      data: { isActive: false, isOnline: false, pairedPhoneDeviceId: null, deviceSecretHash: null, metadata: { unpairedAt: new Date().toISOString() } } as never,
    });
    await this.audit(actor, "smartwatch.device_unpaired", "smartwatch_devices", id, { deviceId: device.deviceId });
    return { data: updated };
  }

  async activateDevice(id: string, actor: JwtPayload) {
    return this.setDeviceActivation(id, true, actor, "smartwatch.device_activated");
  }

  async deactivateDevice(id: string, actor: JwtPayload) {
    return this.setDeviceActivation(id, false, actor, "smartwatch.device_deactivated");
  }

  async remoteWipe(id: string, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can remotely wipe watches");
    const existing = await this.prisma.smartwatchDevice.findUnique({
      where: { id },
      include: { user: { include: { profile: true } }, currentOrganization: true, currentInventoryLocation: true },
    });
    if (!existing) throw new NotFoundException("Smartwatch device not found");
    this.assertAdminCanAccessDevice(existing, actor);
    const device = await this.prisma.smartwatchDevice.update({
      where: { id },
      data: { isActive: false, isOnline: false, remoteWipedAt: new Date(), deviceSecretHash: null, metadata: { remoteWipeQueued: true } } as never,
    });
    await this.audit(actor, "smartwatch.remote_wipe_queued", "smartwatch_devices", id, { deviceId: device.deviceId });
    return { data: device, command: "REMOTE_WIPE" };
  }

  async heartbeat(deviceLookup: string, dto: SmartwatchHeartbeatDto, actor?: JwtPayload) {
    validateHeartbeatDto(dto);
    const device = await this.findAuthorizedDevice(deviceLookup, dto.deviceSecret, actor);
    const nextMode = this.resolveMode(device as any, dto);
    const updated = await this.prisma.smartwatchDevice.update({
      where: { id: device.id },
      data: {
        connectivityMode: nextMode,
        batteryLevel: dto.batteryLevel,
        signalStrength: dto.signalStrength,
        firmwareVersion: dto.firmwareVersion,
        firmwareSignatureStatus: dto.firmwareSignatureStatus,
        isOnline: true,
        lastSeenAt: new Date(),
        metadata: {
          pairedPhoneAvailable: dto.pairedPhoneAvailable ?? null,
          internetAvailable: dto.internetAvailable ?? null,
          failover: nextMode !== (device as any).connectivityMode,
        },
      } as never,
    });

    let threatEvaluation: Record<string, unknown> | null = null;
    if (this.dangerZoneTargeting && dto.latitude != null && dto.longitude != null) {
      threatEvaluation = await this.dangerZoneTargeting.evaluateLocation({
        userId: device.userId,
        deviceId: device.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyMeters: dto.accuracy,
        speedMps: dto.speed,
        headingDegrees: dto.heading,
      });
    }

    const trackingIntervalMs = threatEvaluation?.trackingIntervalMs ?? 300000;
    return {
      data: updated,
      mode: nextMode,
      trackingIntervalMs,
      threat: threatEvaluation,
      commands: this.pendingDeviceCommands(updated as any),
    };
  }

  async recordGps(deviceIdOrPublicId: string, dto: SmartwatchGpsDto, actor?: JwtPayload) {
    validateSmartwatchGpsDto(dto);
    const device = await this.findAuthorizedDevice(deviceIdOrPublicId, dto.deviceSecret, actor);
    const capturedAt = dto.capturedAt ? new Date(dto.capturedAt) : new Date();
    const sourceMode = dto.sourceMode ?? (device as any).connectivityMode ?? "PairedPhone";

    const track = await (this.prisma as any).smartwatchGpsTrack.create({
      data: {
        deviceId: device.id,
        userId: device.userId,
        sosEventId: dto.sosEventId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
        speed: dto.speed,
        heading: dto.heading,
        altitude: dto.altitude,
        batteryLevel: dto.batteryLevel,
        signalStrength: dto.signalStrength,
        capturedAt,
        sourceMode,
        metadata: dto.metadata ?? {},
        gpsLocation: undefined,
      },
    });

    await this.prisma.smartwatchDevice.update({
      where: { id: device.id },
      data: {
        lastLatitude: dto.latitude,
        lastLongitude: dto.longitude,
        lastGpsAccuracy: dto.accuracy,
        lastGpsAt: capturedAt,
        batteryLevel: dto.batteryLevel,
        signalStrength: dto.signalStrength,
        isOnline: true,
        lastSeenAt: new Date(),
      } as never,
    });

    let threatEvaluation: Record<string, unknown> | null = null;
    if (this.dangerZoneTargeting) {
      threatEvaluation = await this.dangerZoneTargeting.evaluateLocation({
        userId: device.userId,
        deviceId: device.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyMeters: dto.accuracy,
        speedMps: dto.speed,
        headingDegrees: dto.heading,
      });
    }

    return {
      data: track,
      realtime: {
        event: "smartwatch.gps.updated",
        deviceId: device.id,
        pollIntervalMs: threatEvaluation?.trackingIntervalMs ?? 5000,
        threat: threatEvaluation,
      },
    };
  }

  async acknowledgeSafetyAlert(alertId: string, deviceLookup: string, dto: { deviceSecret?: string }, actor?: JwtPayload) {
    const device = await this.findAuthorizedDevice(deviceLookup, dto.deviceSecret, actor);
    if (!this.dangerZones) throw new BadRequestException("Danger zone service unavailable");
    return this.dangerZones.acknowledgeAlert(alertId, device.userId, device.id);
  }

  async getAccessibilityPreferences(deviceLookup: string, deviceSecret?: string, actor?: JwtPayload) {
    const device = await this.findAuthorizedDevice(deviceLookup, deviceSecret, actor);
    return {
      deviceId: device.deviceId,
      preferences: readAccessibilityPreferencesFromMetadata((device as any).metadata),
    };
  }

  async updateAccessibilityPreferences(
    deviceLookup: string,
    dto: WatchAccessibilityPreferencesDto,
    deviceSecret?: string,
    actor?: JwtPayload,
  ) {
    const device = await this.findAuthorizedDevice(deviceLookup, deviceSecret, actor);
    const preferences = mergeWatchAccessibilityPreferences(
      (device as any).metadata,
      dto as Partial<import("@the-eye/shared").WatchAccessibilityPreferences>,
    );
    const metadata = writeAccessibilityPreferencesToMetadata((device as any).metadata, preferences);
    await (this.prisma as any).smartwatchDevice.update({
      where: { id: device.id },
      data: { metadata },
    });
    return { deviceId: device.deviceId, preferences };
  }

  async triggerSos(dto: SmartwatchSosDto, actor?: JwtPayload) {
    validateSmartwatchSosDto(dto);
    const lookup = dto.deviceId ?? dto.sourceDeviceId;
    if (!lookup) throw new UnauthorizedException("deviceId is required for smartwatch SOS");
    const device = await this.findAuthorizedDevice(lookup, dto.deviceSecret, actor);
    const sourceMode = dto.sourceMode ?? (device as any).connectivityMode ?? "PairedPhone";
    const metadata = dto.metadata as Record<string, unknown> | undefined;
    const clientSubmissionId =
      typeof metadata?.idempotencyKey === "string" ? metadata.idempotencyKey : undefined;
    const isSilent = dto.emergencyMode === "SilentSOS";

    const actorPayload = {
      sub: device.userId,
      typ: "user" as const,
      permissions: ["incident:create", "incident:read"],
    };

    const incident = isSilent
      ? await this.incidents.reportSos(
          {
            emergencyCategory: EmergencyCategory.SilentSos,
            silent: true,
            latitude: dto.latitude,
            longitude: dto.longitude,
            description: dto.description ?? `Silent SOS from smartwatch device ${device.deviceId}.`,
            notifyEmergencyContacts: false,
            clientSubmissionId,
            deviceId: device.deviceId,
            batteryLevel: dto.batteryLevel,
            capturedAt: dto.capturedAt,
          },
          actorPayload,
        )
      : await this.incidents.report({
          type: IncidentType.SOS,
          title: "Smartwatch SOS alert",
          description: dto.description ?? `SOS triggered from ${sourceMode} smartwatch device ${device.deviceId}.`,
          latitude: dto.latitude,
          longitude: dto.longitude,
          priority: IncidentPriority.P1LifeThreatening,
          anonymous: false,
          notifyEmergencyContacts: false,
          clientSubmissionId,
        }, actorPayload);

    const sosEvent = await (this.prisma as any).sosEvent.create({
      data: {
        userId: device.userId,
        deviceId: device.id,
        incidentId: incident.id,
        status: "Active",
        sourceMode,
        emergencyMode: dto.emergencyMode ?? "NormalSOS",
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
        speed: dto.speed,
        heading: dto.heading,
        altitude: dto.altitude,
        batteryLevel: dto.batteryLevel,
        signalStrength: dto.signalStrength,
        sourceDeviceId: dto.sourceDeviceId ?? device.deviceId,
        triggeredAt: dto.capturedAt ? new Date(dto.capturedAt) : new Date(),
        metadata: { automaticIncident: true, source: "smartwatch", emergencyMode: dto.emergencyMode ?? "NormalSOS", longPressDurationMs: dto.longPressDurationMs ?? null, ...(dto.metadata ?? {}) },
      } as never,
    });

    await this.recordGps(device.deviceId, { ...dto, sosEventId: sosEvent.id, deviceSecret: dto.deviceSecret, sourceMode }, actorPayload);
    const familyAlerted = isSilent ? false : await this.notifyFamilySafetyCircle(device.userId, incident.id, sosEvent.id);
    const updated = await this.prisma.sosEvent.update({
      where: { id: sosEvent.id },
      data: { familyNotifiedAt: familyAlerted ? new Date() : undefined } as never,
    });

    await this.prisma.incidentTimeline.create({
      data: {
        incidentId: incident.id,
        actorId: device.userId,
        actorType: "device",
        eventType: "sos.smartwatch_triggered",
        message: "Smartwatch SOS triggered and emergency incident created automatically.",
        metadata: { sosEventId: sosEvent.id, deviceId: device.deviceId, sourceMode, emergencyMode: dto.emergencyMode ?? "NormalSOS" },
      } as never,
    });

    await this.auditService.record({
      actor: { sub: device.userId, typ: "user" } as JwtPayload,
      actorType: "device",
      action: "sos.smartwatch_triggered",
      entityType: "sos_events",
      entityId: sosEvent.id,
      metadata: { incidentId: incident.id, deviceId: device.deviceId, familyAlerted },
    });

    return { data: updated, incident, familyAlerted, targetProcessingTimeMs: 3000 };
  }

  async emergencyTracking(sosEventId: string, actor: JwtPayload) {
    const event = await this.prisma.sosEvent.findUnique({ where: { id: sosEventId }, include: { incident: true, device: true } });
    if (!event) throw new NotFoundException("SOS event not found");
    if (actor.typ === "user" && event.userId !== actor.sub) throw new ForbiddenException("You can only track your own emergency watch events");
    if (actor.typ === "admin" && event.incident && !this.adminCanAccessIncident(event.incident, actor)) throw new ForbiddenException("SOS event is outside your scope");
    const trail = await (this.prisma as any).smartwatchGpsTrack.findMany({ where: { sosEventId }, orderBy: { capturedAt: "asc" }, take: 1000 });
    return { data: { event, trail, latest: trail[trail.length - 1] ?? null, pollIntervalMs: 5000 } };
  }

  async syncOfflineEvents(deviceLookup: string, dto: SmartwatchOfflineSyncDto, actor?: JwtPayload) {
    validateOfflineSyncDto(dto);
    const device = await this.findAuthorizedDevice(deviceLookup, dto.deviceSecret, actor);
    const created = await Promise.all(dto.events.map((event) =>
      (this.prisma as any).smartwatchOfflineEvent.create({
        data: {
          deviceId: device.id,
          userId: device.userId,
          eventType: event.eventType,
          payload: event.payload,
          occurredAt: new Date(event.occurredAt),
          status: "Uploaded",
        },
      }),
    ));
    await this.prisma.smartwatchDevice.update({ where: { id: device.id }, data: { isOnline: true, lastSeenAt: new Date() } as never });
    void this.processPendingOfflineEvents(device).catch(() => undefined);
    return { data: created, uploaded: created.length };
  }

  private async processPendingOfflineEvents(device: { id: string; userId: string; deviceId: string }) {
    const actor = { sub: device.userId, typ: "user", permissions: ["incident:create", "incident:read"] } as JwtPayload;
    const pending = await (this.prisma as any).smartwatchOfflineEvent.findMany({
      where: { deviceId: device.id, status: "Uploaded", processedAt: null },
      orderBy: { occurredAt: "asc" },
      take: 100,
    });

    for (const event of pending) {
      try {
        const payload = (event.payload ?? {}) as SmartwatchGpsDto;
        const eventType = String(event.eventType).toLowerCase();
        if (eventType === "sos") {
          await this.triggerSos(payload as SmartwatchSosDto, actor);
        } else if (eventType === "gps") {
          await this.recordGps(device.deviceId, payload, actor);
        } else if (eventType === "heartbeat") {
          await this.heartbeat(device.deviceId, payload as SmartwatchHeartbeatDto, actor);
        }
        await (this.prisma as any).smartwatchOfflineEvent.update({
          where: { id: event.id },
          data: { status: "Processed", processedAt: new Date() },
        });
      } catch {
        await (this.prisma as any).smartwatchOfflineEvent.update({
          where: { id: event.id },
          data: { status: "Failed", processedAt: new Date() },
        });
      }
    }
  }

  async adminSosEvents(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can monitor SOS events");
    const events = await this.prisma.sosEvent.findMany({
      include: { user: { include: { profile: true } }, device: true, incident: true },
      orderBy: { triggeredAt: "desc" },
      take: 100,
    });
    return {
      data: events.filter((event) =>
        event.incident
          ? this.adminCanAccessIncident(event.incident, actor)
          : this.adminCanAccessUserProfile(event.user?.profile, actor),
      ),
    };
  }

  async adminDevices(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can view smartwatch devices");
    const devices = await this.prisma.smartwatchDevice.findMany({
      include: {
        user: { include: { profile: true } },
        currentOrganization: true,
        currentInventoryLocation: true,
        sosEvents: { orderBy: { triggeredAt: "desc" }, take: 3 },
      },
      orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    return {
      data: devices
        .filter((device) => this.adminCanAccessDevice(device, actor))
        .map((device) => sanitizeAdminSmartwatchDevice(device as unknown as Record<string, unknown>)),
    };
  }

  async adminGetDevice(id: string, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can view smartwatch devices");
    const device = await this.prisma.smartwatchDevice.findFirst({
      where: smartwatchDeviceLookupWhere(id),
      include: {
        user: { include: { profile: true } },
        currentOrganization: true,
        currentInventoryLocation: true,
        sosEvents: { orderBy: { triggeredAt: "desc" }, take: 20, include: { incident: true } },
        gpsTracks: { orderBy: { capturedAt: "desc" }, take: 50 },
        firmwareUpdates: { orderBy: { startedAt: "desc" }, take: 10, include: { release: true } },
      },
    });
    if (!device) throw new NotFoundException("Smartwatch device not found");
    this.assertAdminCanAccessDevice(device, actor);
    return { data: sanitizeAdminSmartwatchDevice(device as unknown as Record<string, unknown>) };
  }

  async adminListFirmware(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can list firmware releases");
    const releases = await (this.prisma as any).smartwatchFirmwareRelease.findMany({
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
      include: { _count: { select: { updates: true } } },
    });
    return { data: releases };
  }

  async adminListPairingSessions(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can view pairing sessions");
    const sessions = await (this.prisma as any).smartwatchPairingSession.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const deviceIds = sessions.map((session: { deviceId: string }) => session.deviceId);
    const devices = deviceIds.length
      ? await this.prisma.smartwatchDevice.findMany({
          where: { deviceId: { in: deviceIds } },
          include: { user: { include: { profile: true } }, currentOrganization: true, currentInventoryLocation: true },
        })
      : [];
    const deviceByPublicId = new Map(devices.map((device) => [device.deviceId, device]));
    const visibleSessions = sessions.filter((session: { deviceId: string }) => {
      const device = deviceByPublicId.get(session.deviceId);
      return device ? this.adminCanAccessDevice(device, actor) : actor.role === AdminRoleName.SuperAdmin;
    });
    return {
      data: visibleSessions.map((session: Record<string, unknown>) => {
        const device = deviceByPublicId.get(String(session.deviceId));
        return {
          ...session,
          status: this.pairingSessionStatus(session),
          device: device ?? null,
        };
      }),
    };
  }

  async adminIssueActivation(dto: AdminIssueSmartwatchActivationDto, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can issue activation secrets");
    validateAdminIssueActivationDto(dto);
    const existingDevice = await this.prisma.smartwatchDevice.findUnique({
      where: { deviceId: dto.deviceId },
      include: { user: { include: { profile: true } }, currentOrganization: true, currentInventoryLocation: true },
    });
    if (existingDevice) {
      this.assertAdminCanAccessDevice(existingDevice, actor);
    } else if (actor.role !== AdminRoleName.SuperAdmin) {
      throw new ForbiddenException("Only super administrators can issue activation codes for unregistered watches");
    }
    const firebaseEnv = this.defaultFirebaseEnv();
    const ttlMinutes = dto.ttlMinutes ?? 10;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const pairingCode = this.generateSixDigitCode();
    const session = await (this.prisma as any).smartwatchPairingSession.upsert({
      where: { deviceId: dto.deviceId },
      update: {
        pairingCodeHash: hashToken(pairingCode),
        status: WATCH_ACTIVATION_STATUS_ACTIVE,
        failedActivationAttempts: 0,
        firstFailedActivationAt: null,
        lastFailedActivationAt: null,
        activationStatus: ACTIVATION_STATUS_USABLE,
        activationLockedAt: null,
        activationLockReason: null,
        firebaseEnv,
        expiresAt,
        usedAt: null,
        deviceSecretPlain: null,
      },
      create: {
        deviceId: dto.deviceId,
        pairingCodeHash: hashToken(pairingCode),
        status: WATCH_ACTIVATION_STATUS_ACTIVE,
        firebaseEnv,
        expiresAt,
      },
    });
    const qrPayload = JSON.stringify({
      type: "the-eye-smartwatch-activation",
      deviceId: dto.deviceId,
      pairingCode,
      firebaseEnv,
      connectivityMode: dto.connectivityMode ?? "StandaloneCellular",
      expiresAt: expiresAt.toISOString(),
    });
    await (this.prisma as any).smartwatchDevice.updateMany?.({
      where: { deviceId: dto.deviceId },
      data: {
        failedActivationAttempts: 0,
        firstFailedActivationAt: null,
        lastFailedActivationAt: null,
        activationStatus: ACTIVATION_STATUS_USABLE,
        activationLockedAt: null,
        activationLockReason: null,
      } as never,
    });
    await this.audit(actor, "smartwatch.activation_secret_issued", "smartwatch_pairing_sessions", session.id, {
      deviceId: dto.deviceId,
      firebaseEnv,
      expiresAt: expiresAt.toISOString(),
      connectivityMode: dto.connectivityMode ?? "StandaloneCellular",
    });
    return {
      data: {
        deviceId: dto.deviceId,
        pairingCode,
        expiresAt: expiresAt.toISOString(),
        qrPayload,
        firebaseEnv,
        connectivityMode: dto.connectivityMode ?? "StandaloneCellular",
      },
    };
  }

  async adminRevokePairingSession(deviceId: string, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can revoke activation secrets");
    const session = await (this.prisma as any).smartwatchPairingSession.findUnique({ where: { deviceId } });
    if (!session) throw new NotFoundException("Pairing session not found");
    const device = await this.prisma.smartwatchDevice.findUnique({
      where: { deviceId },
      include: { user: { include: { profile: true } }, currentOrganization: true, currentInventoryLocation: true },
    });
    if (device) {
      this.assertAdminCanAccessDevice(device, actor);
    } else if (actor.role !== AdminRoleName.SuperAdmin) {
      throw new ForbiddenException("Pairing session is outside your scope");
    }
    await (this.prisma as any).smartwatchPairingSession.update({
      where: { deviceId },
      data: { status: WATCH_ACTIVATION_STATUS_REVOKED, usedAt: null, deviceSecretPlain: null },
    });
    await this.audit(actor, "smartwatch.activation_secret_revoked", "smartwatch_pairing_sessions", session.id, { deviceId });
    return { revoked: true, deviceId };
  }

  async adminActivationHistory(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can view activation history");
    const logs = await this.prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            "smartwatch.activation_secret_issued",
            "smartwatch.activation_secret_revoked",
            "smartwatch.pairing_code_issued",
            "smartwatch.device_paired",
            "smartwatch.device_activated",
            "smartwatch.device_deactivated",
            "smartwatch.remote_wipe_queued",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    if (actor.role === AdminRoleName.SuperAdmin) return { data: logs };

    const metadataDeviceIds = logs
      .map((log) => (log.metadata as { deviceId?: unknown } | null)?.deviceId)
      .filter((deviceId): deviceId is string => typeof deviceId === "string" && deviceId.length > 0);
    const entityIds = logs
      .filter((log) => log.entityType === "smartwatch_devices" && typeof log.entityId === "string")
      .map((log) => String(log.entityId));
    if (!metadataDeviceIds.length && !entityIds.length) return { data: [] };
    const devices = await this.prisma.smartwatchDevice.findMany({
      where: {
        OR: [
          ...(metadataDeviceIds.length ? [{ deviceId: { in: metadataDeviceIds } }] : []),
          ...(entityIds.length ? [{ id: { in: entityIds } }] : []),
        ],
      },
      include: { user: { include: { profile: true } }, currentOrganization: true, currentInventoryLocation: true },
    });
    const visibleDeviceIds = new Set(
      devices.filter((device) => this.adminCanAccessDevice(device, actor)).flatMap((device) => [device.id, device.deviceId]),
    );
    return {
      data: logs.filter((log) => {
        const metadataDeviceId = (log.metadata as { deviceId?: unknown } | null)?.deviceId;
        return visibleDeviceIds.has(String(metadataDeviceId ?? log.entityId ?? ""));
      }),
    };
  }

  private pairingSessionStatus(session: Record<string, unknown>) {
    if (session.activationStatus === ACTIVATION_STATUS_LOCKED) return "locked";
    if (session.usedAt) return "used";
    if (new Date(String(session.expiresAt)).getTime() < Date.now()) return "expired";
    return "pending";
  }

  private adminCanAccessUserProfile(
    profile: { country?: string | null; state?: string | null; lga?: string | null } | null | undefined,
    actor: JwtPayload,
  ) {
    if (!profile) return actor.role === AdminRoleName.SuperAdmin;
    return this.adminCanAccessIncident(
      { country: profile.country ?? "", state: profile.state ?? "", lga: profile.lga ?? "", assignedAgencyId: null },
      actor,
    );
  }

  async firmwareCheck(deviceLookup: string, dto: { deviceSecret?: string; currentVersion?: string }, actor?: JwtPayload) {
    const device = await this.findAuthorizedDevice(deviceLookup, dto.deviceSecret, actor);
    const release = await (this.prisma as any).smartwatchFirmwareRelease.findFirst({ where: { status: "Published" }, orderBy: { publishedAt: "desc" } });
    const updateAvailable = !!release && release.version !== (dto.currentVersion ?? (device as any).firmwareVersion);
    return { updateAvailable, release: updateAvailable ? release : null, deviceMode: (device as any).connectivityMode };
  }

  async firmwareDownload(deviceLookup: string, version: string, dto: { deviceSecret?: string }, actor?: JwtPayload) {
    const device = await this.findAuthorizedDevice(deviceLookup, dto.deviceSecret, actor);
    const release = await (this.prisma as any).smartwatchFirmwareRelease.findUnique({ where: { version } });
    if (!release || release.status !== "Published") throw new NotFoundException("Published firmware release not found");
    await (this.prisma as any).smartwatchFirmwareUpdate.create({ data: { deviceId: device.id, releaseId: release.id, status: "Started", startedAt: new Date() } });
    return { downloadUrl: release.downloadUrl, fileHash: release.fileHash, signature: release.signature, version: release.version };
  }

  async publishFirmware(dto: SmartwatchFirmwareReleaseDto, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can publish firmware");
    validateFirmwareReleaseDto(dto);
    const release = await (this.prisma as any).smartwatchFirmwareRelease.upsert({
      where: { version: dto.version },
      update: { title: dto.title, releaseNotes: dto.releaseNotes, downloadUrl: dto.downloadUrl, fileHash: dto.fileHash, signature: dto.signature, status: dto.status ?? "Published", publishedAt: dto.status === "Draft" ? null : new Date() },
      create: { version: dto.version, title: dto.title, releaseNotes: dto.releaseNotes, downloadUrl: dto.downloadUrl, fileHash: dto.fileHash, signature: dto.signature, status: dto.status ?? "Published", publishedAt: dto.status === "Draft" ? null : new Date() },
    });
    await this.audit(actor, "smartwatch.firmware_published", "smartwatch_firmware_releases", release.id, { version: dto.version, status: release.status });
    return { data: release };
  }

  async sendCriticalAlert(id: string, dto: SendCriticalAlertDto, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can send device critical alerts");
    validateCriticalAlertDto(dto);
    const device = await this.prisma.smartwatchDevice.findUnique({
      where: { id },
      include: { user: { include: { profile: true } }, currentOrganization: true, currentInventoryLocation: true },
    });
    if (!device) throw new NotFoundException("Smartwatch device not found");
    this.assertAdminCanAccessDevice(device, actor);
    if (!(device as any).criticalAlertsEnabled) throw new ForbiddenException("Critical alerts are disabled for this device");

    await this.prisma.notification.create({
      data: {
        userId: device.userId,
        incidentId: dto.incidentId,
        type: "FamilySosAlert",
        priority: dto.priority === "P1LifeThreatening" || !dto.priority ? "Critical" : "High",
        channel: "watch_push",
        title: dto.title,
        body: dto.body,
        status: "Pending" as never,
        provider: "smartwatch-alert-adapter",
      },
    });
    await this.notifications.enqueue({ channel: "watch_push", deviceId: device.deviceId, userId: device.userId, title: dto.title, body: dto.body, priority: dto.priority ?? "P1LifeThreatening" });
    await this.audit(actor, "smartwatch.critical_alert_sent", "smartwatch_devices", id, { incidentId: dto.incidentId, title: dto.title });
    return { queued: true };
  }

  private async findAuthorizedDevice(deviceLookup: string, deviceSecret?: string, actor?: JwtPayload) {
    const device = await this.prisma.smartwatchDevice.findFirst({
      where: smartwatchDeviceLookupWhere(deviceLookup),
      include: { user: { include: { profile: true } }, currentOrganization: true, currentInventoryLocation: true },
    });
    if (!device || !(device as any).isActive || (device as any).remoteDisabledAt || (device as any).remoteWipedAt) {
      throw new NotFoundException("Active smartwatch device not found");
    }

    if (actor?.typ === "admin") {
      this.assertAdminCanAccessDevice(device, actor);
      return device;
    }

    // Citizen JWT may only skip the device secret when it owns the watch.
    // Standalone activation tokens often use a non-user subject and are dropped by
    // OptionalJwtAuthGuard; when a user JWT is present but does not own the device,
    // fall through to device-secret auth instead of hard-failing.
    if (actor?.typ === "user" && device.userId === actor.sub) {
      return device;
    }

    if (!deviceSecret || (device as any).deviceSecretHash !== hashToken(deviceSecret)) {
      if (actor?.typ === "user") {
        throw new ForbiddenException("Device is not paired to this user");
      }
      throw new UnauthorizedException("Valid device secret is required");
    }
    return device;
  }

  private async setDeviceActivation(id: string, isActive: boolean, actor: JwtPayload, action: string) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can manage watch activation");
    const existing = await this.prisma.smartwatchDevice.findUnique({
      where: { id },
      include: { user: { include: { profile: true } }, currentOrganization: true, currentInventoryLocation: true },
    });
    if (!existing) throw new NotFoundException("Smartwatch device not found");
    this.assertAdminCanAccessDevice(existing, actor);
    const device = await this.prisma.smartwatchDevice.update({
      where: { id },
      data: { isActive, isOnline: isActive ? undefined : false, remoteDisabledAt: isActive ? null : new Date() } as never,
    });
    await this.audit(actor, action, "smartwatch_devices", id, { deviceId: device.deviceId });
    return { data: device };
  }

  private resolveMode(device: { connectivityMode?: string; preferredMode?: string; failoverEnabled?: boolean }, dto: SmartwatchHeartbeatDto) {
    if (dto.connectivityMode) return dto.connectivityMode;
    if (device.preferredMode === "StandaloneCellular") return "StandaloneCellular";
    if (device.failoverEnabled && dto.pairedPhoneAvailable === false && dto.internetAvailable !== false) return "StandaloneCellular";
    return "PairedPhone";
  }

  private pendingDeviceCommands(device: { remoteDisabledAt?: Date | null; remoteWipedAt?: Date | null }) {
    const commands: string[] = [];
    if (device.remoteDisabledAt) commands.push("REMOTE_DISABLE");
    if (device.remoteWipedAt) commands.push("REMOTE_WIPE");
    return commands;
  }

  private async notifyFamilySafetyCircle(userId: string, incidentId: string, sosEventId: string) {
    const contacts = await this.prisma.emergencyContact.findMany({ where: { userId }, orderBy: { priority: "asc" }, take: 10 });
    if (!contacts.length) return false;

    await Promise.all(contacts.map((contact) =>
      this.notifications.enqueue({
        channel: "sms",
        phone: contact.phone,
        title: "THE EYE SOS alert",
        body: `${contact.name}, an SOS was triggered from a paired smartwatch. Incident: ${incidentId}`,
        incidentId,
        sosEventId,
      }),
    ));
    return true;
  }

  private adminCanAccessIncident(incident: { country: string; state: string; lga: string; assignedAgencyId?: string | null }, actor: JwtPayload) {
    if (actor.role === AdminRoleName.SuperAdmin) return true;
    if (actor.role === AdminRoleName.CountryAdmin) return incident.country === actor.country;
    if (actor.role === AdminRoleName.StateAdmin) return incident.country === actor.country && incident.state === actor.state;
    if (actor.role === AdminRoleName.LgaAdmin || actor.role === AdminRoleName.CallCenterAgent || actor.role === AdminRoleName.OversightAuditor) return incident.country === actor.country && incident.state === actor.state && incident.lga === actor.lga;
    if (actor.role === AdminRoleName.AgencyAdmin || actor.role === AdminRoleName.PoliceSecurityOfficer) return incident.assignedAgencyId === actor.agencyId;
    return false;
  }

  private adminCanAccessDevice(
    device: {
      currentOwnerType?: string | null;
      user?: { profile?: { country?: string | null; state?: string | null; lga?: string | null } | null } | null;
      currentOrganization?: { country?: string | null; state?: string | null; lga?: string | null } | null;
      currentInventoryLocation?: { country?: string | null; state?: string | null; lga?: string | null } | null;
    },
    actor: JwtPayload,
  ) {
    if (actor.typ !== "admin") return false;
    if (actor.role === AdminRoleName.SuperAdmin) return true;
    const geography = device.currentOwnerType === WatchOwnerType.Organization
      ? device.currentOrganization
      : device.currentOwnerType === WatchOwnerType.UnassignedInventory
        ? device.currentInventoryLocation
        : device.user?.profile ?? device.currentOrganization ?? device.currentInventoryLocation;
    if (!geography) return false;
    return adminCanAccessGeography(
      {
        country: geography.country ?? undefined,
        state: geography.state ?? undefined,
        lga: geography.lga ?? undefined,
      },
      actor,
    );
  }

  private assertAdminCanAccessDevice(
    device: Parameters<SmartwatchService["adminCanAccessDevice"]>[0],
    actor: JwtPayload,
  ) {
    if (!this.adminCanAccessDevice(device, actor)) throw new ForbiddenException("Device is outside your scope");
  }

  private audit(actor: JwtPayload, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>) {
    return this.auditService.record({
      actor,
      action,
      entityType,
      entityId,
      metadata,
    });
  }

  /**
   * Device-originated audits must not invent a users.id FK. Unassigned inventory
   * watches often have null userId; using device.id (or "system") as actorUserId
   * caused staging activate-with-code to 500 after the device was already written.
   */
  private async recordDeviceAudit(input: {
    action: string;
    entityType: string;
    entityId: string;
    actorUserId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await this.auditService.record({
        actorType: "device",
        actorUserId: input.actorUserId || undefined,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "smartwatch.device_audit_failed",
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }

  private defaultFirebaseEnv() {
    return resolveAppEnvironment({
      THE_EYE_APP_ENV: this.config.get<string>("THE_EYE_APP_ENV"),
      FCM_PROJECT_ID: this.config.get<string>("FCM_PROJECT_ID"),
      FIREBASE_PROJECT_ID: this.config.get<string>("FIREBASE_PROJECT_ID"),
      NODE_ENV: process.env.NODE_ENV,
    });
  }

  private async assertValidPairingCode(dto: RegisterSmartwatchDeviceDto) {
    if ((dto.pairingMethod ?? SmartwatchPairingMethod.PairingCode) !== SmartwatchPairingMethod.PairingCode) return;
    if (!dto.pairingCode) throw new BadRequestException("pairingCode is required for pairing-code flow");

    const session = await (this.prisma as any).smartwatchPairingSession.findUnique({ where: { deviceId: dto.deviceId } });
    if (!session) throw this.genericActivationFailure();
    if ((session as any).activationStatus === ACTIVATION_STATUS_LOCKED) throw this.genericActivationFailure();
    if (session.usedAt) throw this.genericActivationFailure();
    if ((session as any).status && (session as any).status !== WATCH_ACTIVATION_STATUS_ACTIVE) {
      throw this.genericActivationFailure();
    }
    if (new Date(session.expiresAt).getTime() < Date.now()) throw this.genericActivationFailure();

    const env = dto.firebaseEnv ?? this.defaultFirebaseEnv();
    if (session.firebaseEnv !== env) throw this.genericActivationFailure();

    if (session.pairingCodeHash !== hashToken(dto.pairingCode)) {
      await this.registerWatchFailedActivationAttempt(dto.deviceId, session);
      throw this.genericActivationFailure();
    }
  }

  private async completePairingSession(deviceId: string, deviceSecret: string) {
    await (this.prisma as any).smartwatchPairingSession.updateMany({
      where: { deviceId, usedAt: null },
      data: { usedAt: new Date(), status: WATCH_ACTIVATION_STATUS_USED, deviceSecretPlain: deviceSecret },
    });
  }

  private generateSixDigitCode() {
    return String(randomInt(100000, 1000000));
  }

  private async registerWatchFailedActivationAttempt(deviceId: string, currentSession: Record<string, unknown>) {
    await this.withTransaction(async (tx) => {
      await this.lockWatchPairingSession(tx, deviceId);
      const session = await tx.smartwatchPairingSession.findUnique({ where: { deviceId } });
      if (!session || session.activationStatus === ACTIVATION_STATUS_LOCKED) {
        throw this.genericActivationFailure();
      }
      const now = new Date();
      const failedAttempts = Number(session.failedActivationAttempts ?? currentSession.failedActivationAttempts ?? 0) + 1;
      const firstFailedAt = session.firstFailedActivationAt ?? currentSession.firstFailedActivationAt ?? now;
      const shouldLock = failedAttempts >= MAX_FAILED_ACTIVATION_ATTEMPTS;
      await tx.smartwatchPairingSession.update({
        where: { deviceId },
        data: {
          failedActivationAttempts: failedAttempts,
          firstFailedActivationAt: firstFailedAt,
          lastFailedActivationAt: now,
          activationStatus: shouldLock ? ACTIVATION_STATUS_LOCKED : ACTIVATION_STATUS_USABLE,
          activationLockedAt: shouldLock ? now : null,
          activationLockReason: shouldLock ? BRUTE_FORCE_LOCK_REASON : null,
          status: shouldLock ? WATCH_ACTIVATION_STATUS_REVOKED : session.status,
          usedAt: shouldLock ? null : session.usedAt,
          deviceSecretPlain: shouldLock ? null : session.deviceSecretPlain,
        },
      });
      if (shouldLock) {
        const device = await tx.smartwatchDevice.findUnique?.({ where: { deviceId } });
        if (device) {
          await tx.smartwatchDevice.update({
            where: { id: device.id },
            data: {
              failedActivationAttempts: failedAttempts,
              firstFailedActivationAt: firstFailedAt,
              lastFailedActivationAt: now,
              activationStatus: ACTIVATION_STATUS_LOCKED,
              activationLockedAt: now,
              activationLockReason: BRUTE_FORCE_LOCK_REASON,
            } as never,
          });
        }
        await tx.auditLog.create?.({
          data: {
            actorType: "system",
            action: BRUTE_FORCE_LOCK_EVENT,
            entityType: "smartwatch_pairing_sessions",
            entityId: String(session.id),
            reason: BRUTE_FORCE_LOCK_REASON,
            metadata: {
              deviceId,
              deviceType: "smartwatch",
              failedAttemptCount: failedAttempts,
              firstFailedAt: new Date(firstFailedAt).toISOString(),
              lastFailedAt: now.toISOString(),
              lockedAt: now.toISOString(),
              result: "ACTIVATION_LOCKED",
            },
          } as never,
        });
      }
    });
  }

  private async withTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    if (typeof (this.prisma as any).$transaction !== "function") {
      return callback(this.prisma as any);
    }
    return (this.prisma as any).$transaction(callback);
  }

  private async lockWatchPairingSession(client: any, deviceId: string) {
    if (typeof client.$queryRawUnsafe !== "function") return;
    await client.$queryRawUnsafe(
      'SELECT "device_id" FROM "smartwatch_pairing_sessions" WHERE "device_id" = $1 FOR UPDATE',
      deviceId,
    );
  }

  private genericActivationFailure() {
    return new UnauthorizedException("Device activation could not be completed.");
  }
}

function isStandaloneActivationSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = String((error as { message?: unknown }).message ?? "");
  const code = String((error as { code?: unknown }).code ?? "");
  if (code === "P2022") return true;
  return (
    /user_id.*null/i.test(message) ||
    /column.*does not exist/i.test(message) ||
    /assignment_status/i.test(message) ||
    /inventory_status/i.test(message) ||
    /current_owner_type/i.test(message) ||
    /ownership_status/i.test(message)
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Avoid querying Postgres uuid columns with public device serials (e.g. EYE-WATCH-001). */
export function isUuidLookup(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function smartwatchDeviceLookupWhere(deviceLookup: string): {
  OR?: Array<{ id: string } | { deviceId: string }>;
  deviceId?: string;
} {
  const lookup = deviceLookup.trim();
  if (isUuidLookup(lookup)) {
    return { OR: [{ id: lookup }, { deviceId: lookup }] };
  }
  return { deviceId: lookup };
}

export function sanitizeAdminSmartwatchDevice(device: Record<string, unknown>) {
  const {
    deviceSecretHash: _deviceSecretHash,
    pairingCodeHash: _pairingCodeHash,
    deviceCertificate: _deviceCertificate,
    publicKey: _publicKey,
    metadata: _metadata,
    ...safeDevice
  } = device;
  return safeDevice;
}
