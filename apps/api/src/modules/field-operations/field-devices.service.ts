import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  FIELD_ERROR_CODES,
  FieldDeviceRegistrationStatus,
  adminRolePermissions,
  canApproveFieldDevices,
  isFieldEligibleAdminRole,
  resolveFieldOperationalRole,
} from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { hashToken, randomToken } from "../../common/auth/crypto";
import { verifyFieldDeviceSignature } from "../../common/auth/field-device-crypto";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CompleteFieldPairingDto,
  FieldDeviceHeartbeatDto,
  FieldDeviceRegistrationStatusQuery,
  RegisterFieldDeviceDto,
} from "./dto/field-devices.dto";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class FieldDevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async createRegistrationChallenge() {
    const challenge = randomToken(32);
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
    const record = await this.prisma.fieldDeviceRegistrationChallenge.create({
      data: {
        challengeHash: hashToken(challenge),
        expiresAt,
      },
    });
    await this.audit.record({
      actor: { sub: "system", typ: "admin", permissions: [] },
      action: "field.device.registration_challenge",
      entityType: "field_device_registration_challenge",
      entityId: record.id,
      metadata: { expiresAt: expiresAt.toISOString() },
    });
    return {
      data: {
        challengeId: record.id,
        challenge,
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  private async consumeChallenge(challengeId: string, challenge: string) {
    const record = await this.prisma.fieldDeviceRegistrationChallenge.findUnique({ where: { id: challengeId } });
    if (!record || record.consumedAt || record.expiresAt <= new Date()) {
      throw new UnauthorizedException({ code: FIELD_ERROR_CODES.DEVICE_SIGNATURE_INVALID, message: "Registration challenge expired or invalid" });
    }
    if (record.challengeHash !== hashToken(challenge)) {
      throw new UnauthorizedException({ code: FIELD_ERROR_CODES.DEVICE_SIGNATURE_INVALID, message: "Registration challenge mismatch" });
    }
    await this.prisma.fieldDeviceRegistrationChallenge.update({
      where: { id: challengeId },
      data: { consumedAt: new Date() },
    });
  }

  async registerDevice(actor: JwtPayload, dto: RegisterFieldDeviceDto) {
    if (actor.typ !== "admin") throw new ForbiddenException("Admin authentication required for device registration");
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: actor.sub },
      include: { role: true },
    });
    if (!admin?.isActive) throw new UnauthorizedException("Officer account inactive");
    if (!isFieldEligibleAdminRole(admin.role.name)) {
      throw new ForbiddenException({ code: FIELD_ERROR_CODES.ROLE_NOT_AUTHORIZED, message: "Role not authorized for field tablet registration" });
    }
    if (!dto.publicKey || !dto.installationIdHash || !dto.deviceName) {
      throw new BadRequestException("Device identity and public key are required");
    }
    await this.consumeChallenge(dto.challengeId, dto.challenge);
    if (!verifyFieldDeviceSignature(dto.publicKey, dto.challenge, dto.challengeSignature)) {
      throw new UnauthorizedException({ code: FIELD_ERROR_CODES.DEVICE_SIGNATURE_INVALID, message: "Device signature invalid" });
    }

    const existing = await this.prisma.fieldDevice.findUnique({ where: { installationIdHash: dto.installationIdHash } });
    if (existing) {
      if (existing.registrationStatus === FieldDeviceRegistrationStatus.Revoked) {
        throw new ForbiddenException({ code: FIELD_ERROR_CODES.DEVICE_REVOKED, message: "Device revoked" });
      }
      return { data: this.mapDevice(existing), duplicate: true };
    }

    const publicDeviceId = `fd_${randomToken(12)}`;
    const device = await this.prisma.fieldDevice.create({
      data: {
        publicDeviceId,
        publicKey: dto.publicKey,
        installationIdHash: dto.installationIdHash,
        serialHash: dto.serialHash,
        deviceName: dto.deviceName,
        manufacturer: dto.manufacturer,
        model: dto.model,
        androidVersion: dto.androidVersion,
        appVersion: dto.appVersion,
        buildNumber: dto.buildNumber,
        packageName: dto.packageName,
        appEnvironment: dto.appEnvironment ?? this.config.get("THE_EYE_APP_ENV"),
        assignedUserId: admin.id,
        agencyId: admin.agencyId,
        countryCode: admin.country,
        stateCode: admin.state,
        lgaCode: admin.lga,
        registrationStatus: FieldDeviceRegistrationStatus.PendingApproval,
        metadata: (dto.metadata ?? {}) as never,
      },
    });

    await this.audit.record({
      actor,
      action: "field.device.registration_submitted",
      entityType: "field_device",
      entityId: device.id,
      metadata: { publicDeviceId: device.publicDeviceId, assignedUserId: admin.id },
    });

    return { data: this.mapDevice(device) };
  }

  async getRegistrationStatus(query: FieldDeviceRegistrationStatusQuery) {
    const device = query.publicDeviceId
      ? await this.prisma.fieldDevice.findUnique({ where: { publicDeviceId: query.publicDeviceId } })
      : query.installationIdHash
        ? await this.prisma.fieldDevice.findUnique({ where: { installationIdHash: query.installationIdHash } })
        : null;
    if (!device) throw new NotFoundException("Device registration not found");
    return { data: this.mapDevice(device) };
  }

  async completePairing(dto: CompleteFieldPairingDto) {
    const device = await this.prisma.fieldDevice.findUnique({ where: { publicDeviceId: dto.publicDeviceId } });
    if (!device) throw new NotFoundException("Device not found");
    this.assertDeviceCanAuthenticate(device);
    if (device.registrationStatus !== FieldDeviceRegistrationStatus.Active) {
      throw new ForbiddenException({ code: FIELD_ERROR_CODES.DEVICE_APPROVAL_PENDING, message: "Device not approved" });
    }
    await this.consumeChallenge(dto.challengeId, dto.challenge);
    if (!verifyFieldDeviceSignature(device.publicKey, dto.challenge, dto.challengeSignature)) {
      throw new UnauthorizedException({ code: FIELD_ERROR_CODES.DEVICE_SIGNATURE_INVALID, message: "Device signature invalid" });
    }
    await this.prisma.fieldDevice.update({
      where: { id: device.id },
      data: { requiresRePair: false, lastAuthenticatedAt: new Date() },
    });
    await this.audit.record({
      actor: { sub: device.assignedUserId ?? "system", typ: "admin", permissions: [] },
      action: "field.device.pairing_completed",
      entityType: "field_device",
      entityId: device.id,
    });
    return { data: { publicDeviceId: device.publicDeviceId, status: device.registrationStatus, paired: true } };
  }

  async heartbeat(publicDeviceId: string, dto: FieldDeviceHeartbeatDto, actor?: JwtPayload) {
    const device = await this.findAuthorizedDevice(publicDeviceId, actor);
    await this.prisma.fieldDevice.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        appVersion: dto.appVersion ?? device.appVersion,
        androidVersion: dto.androidVersion ?? device.androidVersion,
        buildNumber: dto.buildNumber ?? device.buildNumber,
        batteryLevel: dto.batteryLevel ?? device.batteryLevel,
        chargingState: dto.chargingState ?? device.chargingState,
        networkType: dto.networkType ?? device.networkType,
        notificationPermission: dto.notificationPermission ?? device.notificationPermission,
        locationPermission: dto.locationPermission ?? device.locationPermission,
        cameraPermission: dto.cameraPermission ?? device.cameraPermission,
        microphonePermission: dto.microphonePermission ?? device.microphonePermission,
        isRootRiskDetected: dto.isRootRiskDetected ?? device.isRootRiskDetected,
        lastKnownLatitude: dto.latitude ?? device.lastKnownLatitude,
        lastKnownLongitude: dto.longitude ?? device.lastKnownLongitude,
        lastLocationAccuracy: dto.locationAccuracyMeters ?? device.lastLocationAccuracy,
        lastLocationAt: dto.latitude != null ? new Date() : device.lastLocationAt,
        metadata: {
          ...(device.metadata as object),
          lastSyncAt: dto.lastSyncAt,
          activeMode: dto.activeMode,
          crashCount: dto.crashCount,
        } as never,
      },
    });
    await this.audit.record({
      actor: { sub: device.assignedUserId ?? "system", typ: "admin", permissions: [] },
      action: "field.device.heartbeat",
      entityType: "field_device",
      entityId: device.id,
      metadata: { batteryLevel: dto.batteryLevel, networkType: dto.networkType },
    });
    return { data: { accepted: true, serverTime: new Date().toISOString() } };
  }

  async findAuthorizedDevice(publicDeviceId: string, actor?: JwtPayload) {
    const device = await this.prisma.fieldDevice.findUnique({ where: { publicDeviceId } });
    if (!device) throw new NotFoundException("Field device not found");
    if (actor?.typ === "field" && actor.fieldDeviceId !== device.id) {
      throw new ForbiddenException("Device scope mismatch");
    }
    if (actor?.typ === "admin" && actor.sub !== device.assignedUserId && !canApproveFieldDevices(actor.role ?? "")) {
      throw new ForbiddenException({ code: FIELD_ERROR_CODES.JURISDICTION_MISMATCH, message: "Out of scope" });
    }
    return device;
  }

  assertDeviceCanAuthenticate(device: {
    registrationStatus: string;
    isLost: boolean;
    isRevoked: boolean;
    requiresRePair: boolean;
  }) {
    if (device.registrationStatus === FieldDeviceRegistrationStatus.PendingApproval) {
      throw new ForbiddenException({ code: FIELD_ERROR_CODES.DEVICE_APPROVAL_PENDING, message: "Approval pending" });
    }
    if (device.registrationStatus === FieldDeviceRegistrationStatus.Suspended) {
      throw new ForbiddenException({ code: FIELD_ERROR_CODES.DEVICE_SUSPENDED, message: "Device suspended" });
    }
    if (device.isLost || device.registrationStatus === FieldDeviceRegistrationStatus.Lost) {
      throw new ForbiddenException({ code: FIELD_ERROR_CODES.DEVICE_MARKED_LOST, message: "Device marked lost" });
    }
    if (device.isRevoked || device.registrationStatus === FieldDeviceRegistrationStatus.Revoked) {
      throw new ForbiddenException({ code: FIELD_ERROR_CODES.DEVICE_REVOKED, message: "Device revoked" });
    }
    if (device.requiresRePair) {
      throw new ForbiddenException({ code: FIELD_ERROR_CODES.DEVICE_REPAIR_REQUIRED, message: "Re-pair required" });
    }
    if (device.registrationStatus !== FieldDeviceRegistrationStatus.Active) {
      throw new ForbiddenException({ code: FIELD_ERROR_CODES.DEVICE_REGISTRATION_REQUIRED, message: "Device not active" });
    }
  }

  mapDevice(device: {
    id: string;
    publicDeviceId: string;
    deviceName: string;
    manufacturer: string | null;
    model: string | null;
    registrationStatus: string;
    assignedUserId: string | null;
    agencyId: string | null;
    assignedUnitId: string | null;
    countryCode?: string | null;
    stateCode?: string | null;
    lgaCode?: string | null;
    appVersion: string | null;
    androidVersion: string | null;
    lastSeenAt: Date | null;
    batteryLevel: number | null;
    networkType: string | null;
    isLost: boolean;
    isRevoked: boolean;
    requiresRePair: boolean;
    isRootRiskDetected?: boolean;
    approvedAt: Date | null;
    registeredAt: Date;
  }) {
    return {
      id: device.id,
      publicDeviceId: device.publicDeviceId,
      deviceName: device.deviceName,
      manufacturer: device.manufacturer,
      model: device.model,
      registrationStatus: device.registrationStatus,
      assignedUserId: device.assignedUserId,
      agencyId: device.agencyId,
      assignedUnitId: device.assignedUnitId,
      countryCode: device.countryCode ?? null,
      stateCode: device.stateCode ?? null,
      lgaCode: device.lgaCode ?? null,
      appVersion: device.appVersion,
      androidVersion: device.androidVersion,
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
      batteryLevel: device.batteryLevel,
      networkType: device.networkType,
      isLost: device.isLost,
      isRevoked: device.isRevoked,
      requiresRePair: device.requiresRePair,
      isRootRiskDetected: device.isRootRiskDetected ?? false,
      approvedAt: device.approvedAt?.toISOString() ?? null,
      registeredAt: device.registeredAt.toISOString(),
    };
  }

  async loadAdminActor(adminId: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId }, include: { role: true } });
    if (!admin?.isActive) throw new UnauthorizedException("Officer inactive");
    const fieldRole = resolveFieldOperationalRole(admin.role.name);
    if (!fieldRole || !isFieldEligibleAdminRole(admin.role.name)) {
      throw new ForbiddenException({ code: FIELD_ERROR_CODES.ROLE_NOT_AUTHORIZED, message: "Role not authorized" });
    }
    return { admin, fieldRole, permissions: adminRolePermissions[admin.role.name as keyof typeof adminRolePermissions] ?? [] };
  }
}
