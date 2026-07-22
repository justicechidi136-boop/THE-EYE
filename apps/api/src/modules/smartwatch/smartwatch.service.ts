import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AdminRoleName, IncidentPriority, IncidentType, SmartwatchPairingMethod } from "@the-eye/shared";
import { randomToken, hashToken } from "../../common/auth/crypto";
import { signJwt, type JwtPayload } from "../../common/auth/jwt";
import { requireJwtAccessSecret } from "../../common/auth/jwt-secrets";
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
  UpdateSmartwatchStatusDto,
  IssueSmartwatchPairingCodeDto,
  validateCriticalAlertDto,
  validateFirmwareReleaseDto,
  validateHeartbeatDto,
  validateIssuePairingCodeDto,
  validateOfflineSyncDto,
  validateRegisterSmartwatchDeviceDto,
  validateStandaloneLoginDto,
  validateSmartwatchGpsDto,
  validateSmartwatchSosDto,
  validateSmartwatchStatusDto,
} from "./dto/smartwatch.dto";

const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class SmartwatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly incidents: IncidentsService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async registerDevice(dto: RegisterSmartwatchDeviceDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can pair smartwatch devices");
    validateRegisterSmartwatchDeviceDto(dto);
    await this.assertValidPairingCode(dto);

    const deviceSecret = randomToken(32);
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
      } as never,
    });

    await this.audit(actor, "smartwatch.device_paired", "smartwatch_devices", device.id, { deviceId: dto.deviceId, connectivityMode: dto.connectivityMode ?? "PairedPhone" });
    await this.completePairingSession(dto.deviceId, deviceSecret);
    return { data: device, deviceSecret };
  }

  async issuePairingCode(dto: IssueSmartwatchPairingCodeDto) {
    validateIssuePairingCodeDto(dto);
    const firebaseEnv = dto.firebaseEnv ?? this.defaultFirebaseEnv();
    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
    const session = await (this.prisma as any).smartwatchPairingSession.upsert({
      where: { deviceId: dto.deviceId },
      update: {
        pairingCodeHash: hashToken(dto.pairingCode),
        firebaseEnv,
        expiresAt,
        usedAt: null,
        deviceSecretPlain: null,
      },
      create: {
        deviceId: dto.deviceId,
        pairingCodeHash: hashToken(dto.pairingCode),
        firebaseEnv,
        expiresAt,
      },
    });

    await this.auditService.record({
      actor: { sub: "system", typ: "user" } as JwtPayload,
      actorType: "device",
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
    if (session.usedAt && session.deviceSecretPlain) {
      const secret = session.deviceSecretPlain as string;
      await (this.prisma as any).smartwatchPairingSession.update({
        where: { deviceId },
        data: { deviceSecretPlain: null },
      });
      return { data: { status: "paired", deviceSecret: secret } };
    }
    if (session.usedAt) return { data: { status: "paired" } };
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      return { data: { status: "expired" } };
    }
    return { data: { status: "pending", expiresAt: session.expiresAt } };
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

    await this.auditService.record({
      actor: { sub: device.userId, typ: "user" } as JwtPayload,
      actorType: "device",
      action: "smartwatch.standalone_login",
      entityType: "smartwatch_devices",
      entityId: device.id,
      metadata: { deviceId: device.deviceId },
    });
    return { accessToken: token, tokenType: "Bearer", mode: "StandaloneCellular", expiresInSeconds: 900 };
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
    const device = await this.prisma.smartwatchDevice.findUnique({ where: { id } });
    if (!device) throw new NotFoundException("Smartwatch device not found");
    if (actor.typ === "user" && device.userId !== actor.sub) throw new ForbiddenException("You can only update your own smartwatch devices");

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
    const device = await this.prisma.smartwatchDevice.findUnique({ where: { id } });
    if (!device) throw new NotFoundException("Smartwatch device not found");
    if (actor.typ === "user" && device.userId !== actor.sub) throw new ForbiddenException("You can only remove your own smartwatch devices");
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
    return { data: updated, mode: nextMode, trackingIntervalMs: 5000, commands: this.pendingDeviceCommands(updated as any) };
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

    return { data: track, realtime: { event: "smartwatch.gps.updated", deviceId: device.id, pollIntervalMs: 5000 } };
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

    const incident = await this.incidents.report({
      type: IncidentType.SOS,
      title: "Smartwatch SOS alert",
      description: dto.description ?? `SOS triggered from ${sourceMode} smartwatch device ${device.deviceId}.`,
      latitude: dto.latitude,
      longitude: dto.longitude,
      priority: IncidentPriority.P1LifeThreatening,
      anonymous: false,
      notifyEmergencyContacts: false,
      clientSubmissionId,
    }, {
      sub: device.userId,
      typ: "user",
      permissions: ["incident:create", "incident:read"],
    });

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

    await this.recordGps(device.deviceId, { ...dto, sosEventId: sosEvent.id, deviceSecret: dto.deviceSecret, sourceMode }, { sub: device.userId, typ: "user", permissions: ["incident:create"] });
    const familyAlerted = await this.notifyFamilySafetyCircle(device.userId, incident.id, sosEvent.id);
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
    return { data: events.filter((event) => !event.incident || this.adminCanAccessIncident(event.incident, actor)) };
  }

  async adminDevices(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can view smartwatch devices");
    const devices = await this.prisma.smartwatchDevice.findMany({
      include: { user: { include: { profile: true } }, sosEvents: { orderBy: { triggeredAt: "desc" }, take: 3 } },
      orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    return {
      data: devices.filter((device) => this.adminCanAccessUserProfile(device.user?.profile, actor)),
    };
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
    const device = await this.prisma.smartwatchDevice.findUnique({ where: { id }, include: { user: true } });
    if (!device) throw new NotFoundException("Smartwatch device not found");
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
      where: { OR: [{ id: deviceLookup }, { deviceId: deviceLookup }] },
    });
    if (!device || !(device as any).isActive || (device as any).remoteDisabledAt || (device as any).remoteWipedAt) throw new NotFoundException("Active smartwatch device not found");

    if (actor?.typ === "user") {
      if (device.userId !== actor.sub) throw new ForbiddenException("Device is not paired to this user");
      return device;
    }

    if (actor?.typ === "admin") return device;
    if (!deviceSecret || (device as any).deviceSecretHash !== hashToken(deviceSecret)) throw new UnauthorizedException("Valid device secret is required");
    return device;
  }

  private async setDeviceActivation(id: string, isActive: boolean, actor: JwtPayload, action: string) {
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

  private audit(actor: JwtPayload, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>) {
    return this.auditService.record({
      actor,
      action,
      entityType,
      entityId,
      metadata,
    });
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
    if (!session) throw new BadRequestException("No active pairing session for this device");
    if (session.usedAt) throw new BadRequestException("Pairing code has already been used");
    if (new Date(session.expiresAt).getTime() < Date.now()) throw new BadRequestException("Pairing code has expired");

    const env = dto.firebaseEnv ?? this.defaultFirebaseEnv();
    if (session.firebaseEnv !== env) throw new BadRequestException("Pairing code was issued for a different Firebase environment");

    if (session.pairingCodeHash !== hashToken(dto.pairingCode)) {
      throw new BadRequestException("Invalid pairing code");
    }
  }

  private async completePairingSession(deviceId: string, deviceSecret: string) {
    await (this.prisma as any).smartwatchPairingSession.updateMany({
      where: { deviceId, usedAt: null },
      data: { usedAt: new Date(), deviceSecretPlain: deviceSecret },
    });
  }
}
