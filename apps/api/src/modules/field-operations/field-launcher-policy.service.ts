import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { JwtPayload } from "../../common/auth/jwt";
import { assertFieldSession } from "./field-session.util";

const DEFAULT_APPROVED_APPS = [
  "com.google.android.apps.maps",
  "com.android.camera2",
  "com.google.android.dialer",
  "com.android.chrome",
];

/** Maps FieldOperationalRole (packages/shared) values onto the launcher's role/module vocabulary. */
const OPERATIONAL_ROLE_TO_LAUNCHER_ROLE: Record<string, string> = {
  PatrolOfficer: "officer",
  PatrolTeamLead: "patrol",
  CheckpointOfficer: "checkpoint",
  CheckpointCommander: "checkpoint",
  Dispatcher: "officer",
  AgencySupervisor: "supervisor",
  EmergencyResponder: "officer",
  DroneOperator: "drone",
  FieldReadOnlyObserver: "officer",
};

const ROLE_MODULES: Record<string, string[]> = {
  officer: [
    "dashboard",
    "patrol",
    "assignments",
    "incident_map",
    "bolo",
    "comms",
    "backup",
    "officer_safety",
    "device_status",
  ],
  patrol: [
    "dashboard",
    "patrol",
    "assignments",
    "incident_map",
    "bolo",
    "comms",
    "backup",
    "officer_safety",
    "device_status",
  ],
  checkpoint: [
    "checkpoint",
    "assignments",
    "bolo",
    "broadcasts",
    "backup",
    "comms",
    "device_status",
    "officer_safety",
  ],
  drone: [
    "drone",
    "incident_map",
    "assignments",
    "comms",
    "backup",
    "device_status",
    "officer_safety",
  ],
  supervisor: [
    "dashboard",
    "patrol",
    "checkpoint",
    "assignments",
    "incident_map",
    "bolo",
    "broadcasts",
    "drone",
    "comms",
    "backup",
    "officer_safety",
    "device_status",
  ],
  commander: [
    "dashboard",
    "patrol",
    "checkpoint",
    "assignments",
    "incident_map",
    "bolo",
    "broadcasts",
    "drone",
    "comms",
    "backup",
    "officer_safety",
    "device_status",
  ],
};

export type LauncherPolicyPatch = {
  deviceMode?: string;
  launcherEnabled?: boolean;
  kioskEnabled?: boolean;
  approvedApps?: string[];
  settingsAccessLevel?: string;
  maintenanceModeAllowed?: boolean;
  emergencyDialerAllowed?: boolean;
  browserAllowed?: boolean;
  screenshotsAllowed?: boolean;
  usbPolicy?: string;
  autoLockMinutes?: number;
  visibleModules?: string[];
  role?: string;
};

@Injectable()
export class FieldLauncherPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getPolicyForFieldSession(actor: JwtPayload) {
    const session = assertFieldSession(actor);
    const device = await this.prisma.fieldDevice.findUnique({
      where: { id: session.fieldDeviceId },
      include: { launcherPolicy: true, agency: true },
    });
    if (!device) throw new NotFoundException("Field device not found");
    if (device.isRevoked || device.isLost || device.registrationStatus === "Suspended") {
      // Still return policy so launcher can render lock UX with dialer flags.
    }
    const role = (session.fieldRole || device.launcherPolicy?.role || "officer").toLowerCase();
    const policy = device.launcherPolicy ?? (await this.ensureDefaultPolicy(device.id, role));
    return this.toDto(policy, {
      agencyId: device.agencyId,
      deviceReference: device.publicDeviceId,
      role,
      locked: device.isRevoked || device.isLost || device.registrationStatus === "Suspended",
      lockReason: device.isRevoked
        ? "Device revoked"
        : device.isLost
          ? "Device marked lost"
          : device.registrationStatus === "Suspended"
            ? "Device suspended"
            : null,
    });
  }

  async getPolicyForAdmin(deviceId: string, actor: JwtPayload) {
    const device = await this.prisma.fieldDevice.findUnique({
      where: { id: deviceId },
      include: { launcherPolicy: true },
    });
    if (!device) throw new NotFoundException("Field device not found");
    const policy = device.launcherPolicy ?? (await this.ensureDefaultPolicy(device.id, "officer"));
    return this.toDto(policy, {
      agencyId: device.agencyId,
      deviceReference: device.publicDeviceId,
      role: policy.role,
    });
  }

  async patchPolicyForAdmin(deviceId: string, actor: JwtPayload, patch: LauncherPolicyPatch) {
    if (actor.typ !== "admin") {
      throw new BadRequestException("Admin session required");
    }
    const device = await this.prisma.fieldDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException("Field device not found");
    this.validatePatch(patch);

    const existing = await this.prisma.fieldDeviceLauncherPolicy.findUnique({
      where: { fieldDeviceId: deviceId },
    });
    const role = (patch.role ?? existing?.role ?? "officer").toLowerCase();
    const data = {
      deviceMode: patch.deviceMode ?? existing?.deviceMode ?? "standard",
      launcherEnabled: patch.launcherEnabled ?? existing?.launcherEnabled ?? false,
      kioskEnabled: patch.kioskEnabled ?? existing?.kioskEnabled ?? false,
      approvedApps: patch.approvedApps ?? (existing?.approvedApps as string[] | undefined) ?? DEFAULT_APPROVED_APPS,
      settingsAccessLevel: patch.settingsAccessLevel ?? existing?.settingsAccessLevel ?? "none",
      maintenanceModeAllowed:
        patch.maintenanceModeAllowed ?? existing?.maintenanceModeAllowed ?? false,
      emergencyDialerAllowed:
        patch.emergencyDialerAllowed ?? existing?.emergencyDialerAllowed ?? true,
      browserAllowed: patch.browserAllowed ?? existing?.browserAllowed ?? true,
      screenshotsAllowed: patch.screenshotsAllowed ?? existing?.screenshotsAllowed ?? true,
      usbPolicy: patch.usbPolicy ?? existing?.usbPolicy ?? "allow",
      autoLockMinutes: patch.autoLockMinutes ?? existing?.autoLockMinutes ?? 15,
      visibleModules:
        patch.visibleModules ??
        (existing?.visibleModules as string[] | undefined) ??
        ROLE_MODULES[role] ??
        ROLE_MODULES.officer,
      role,
      policyVersion: (existing?.policyVersion ?? 0) + 1,
      updatedById: actor.sub,
    };

    const policy = await this.prisma.fieldDeviceLauncherPolicy.upsert({
      where: { fieldDeviceId: deviceId },
      create: { fieldDeviceId: deviceId, ...data },
      update: data,
    });

    await this.audit.record({
      actor,
      action: "field.device.launcher_policy_updated",
      entityType: "field_device",
      entityId: deviceId,
      metadata: {
        deviceMode: policy.deviceMode,
        launcherEnabled: policy.launcherEnabled,
        kioskEnabled: policy.kioskEnabled,
        policyVersion: policy.policyVersion,
      },
    });

    return this.toDto(policy, {
      agencyId: device.agencyId,
      deviceReference: device.publicDeviceId,
      role: policy.role,
    });
  }

  async recordLauncherAudit(actor: JwtPayload, body: { action?: string; packageName?: string; ok?: boolean; environment?: string }) {
    const session = assertFieldSession(actor);
    const action = (body.action ?? "field.launcher.event").slice(0, 120);
    await this.audit.record({
      actor,
      action,
      entityType: "field_device",
      entityId: session.fieldDeviceId,
      metadata: {
        packageName: body.packageName ?? null,
        ok: body.ok ?? null,
        environment: body.environment ?? null,
      },
    });
    return { ok: true };
  }

  /** Applies sensible launcher-policy defaults right after a pre-provisioned device finishes pairing. */
  async applyPairingDefaults(fieldDeviceId: string, operationalRole: string, deviceMode?: string) {
    const role = OPERATIONAL_ROLE_TO_LAUNCHER_ROLE[operationalRole] ?? "officer";
    const policy = await this.ensureDefaultPolicy(fieldDeviceId, role);
    if (deviceMode && deviceMode !== policy.deviceMode) {
      await this.prisma.fieldDeviceLauncherPolicy.update({
        where: { fieldDeviceId },
        data: { deviceMode },
      });
    }
  }

  private async ensureDefaultPolicy(fieldDeviceId: string, role: string) {
    const modules = ROLE_MODULES[role] ?? ROLE_MODULES.officer!;
    return this.prisma.fieldDeviceLauncherPolicy.upsert({
      where: { fieldDeviceId },
      create: {
        fieldDeviceId,
        deviceMode: "standard",
        launcherEnabled: false,
        kioskEnabled: false,
        approvedApps: DEFAULT_APPROVED_APPS,
        settingsAccessLevel: "none",
        maintenanceModeAllowed: true,
        emergencyDialerAllowed: true,
        browserAllowed: true,
        screenshotsAllowed: true,
        usbPolicy: "allow",
        autoLockMinutes: 15,
        visibleModules: modules,
        role,
        policyVersion: 1,
      },
      update: {},
    });
  }

  private validatePatch(patch: LauncherPolicyPatch) {
    if (patch.deviceMode && !["standard", "launcher", "managed_kiosk"].includes(patch.deviceMode)) {
      throw new BadRequestException("deviceMode must be standard|launcher|managed_kiosk");
    }
    if (
      patch.settingsAccessLevel &&
      !["none", "restricted", "supervisor"].includes(patch.settingsAccessLevel)
    ) {
      throw new BadRequestException("settingsAccessLevel must be none|restricted|supervisor");
    }
    if (patch.usbPolicy && !["allow", "charge_only", "deny"].includes(patch.usbPolicy)) {
      throw new BadRequestException("usbPolicy must be allow|charge_only|deny");
    }
    if (patch.autoLockMinutes != null && (patch.autoLockMinutes < 1 || patch.autoLockMinutes > 240)) {
      throw new BadRequestException("autoLockMinutes must be between 1 and 240");
    }
  }

  private toDto(
    policy: {
      deviceMode: string;
      launcherEnabled: boolean;
      kioskEnabled: boolean;
      approvedApps: unknown;
      settingsAccessLevel: string;
      maintenanceModeAllowed: boolean;
      emergencyDialerAllowed: boolean;
      browserAllowed: boolean;
      screenshotsAllowed: boolean;
      usbPolicy: string;
      autoLockMinutes: number;
      visibleModules: unknown;
      role: string;
      policyVersion: number;
      updatedAt: Date;
    },
    extras: {
      agencyId?: string | null;
      deviceReference?: string;
      role?: string;
      locked?: boolean;
      lockReason?: string | null;
    },
  ) {
    return {
      deviceMode: policy.deviceMode,
      launcherEnabled: policy.launcherEnabled,
      kioskEnabled: policy.kioskEnabled,
      approvedApps: Array.isArray(policy.approvedApps) ? policy.approvedApps : DEFAULT_APPROVED_APPS,
      settingsAccessLevel: policy.settingsAccessLevel,
      maintenanceModeAllowed: policy.maintenanceModeAllowed,
      emergencyDialerAllowed: policy.emergencyDialerAllowed,
      browserAllowed: policy.browserAllowed,
      screenshotsAllowed: policy.screenshotsAllowed,
      usbPolicy: policy.usbPolicy,
      autoLockMinutes: policy.autoLockMinutes,
      visibleModules: Array.isArray(policy.visibleModules)
        ? policy.visibleModules
        : ROLE_MODULES[policy.role] ?? ROLE_MODULES.officer,
      role: extras.role ?? policy.role,
      policyVersion: policy.policyVersion,
      agencyId: extras.agencyId ?? null,
      deviceReference: extras.deviceReference ?? null,
      locked: extras.locked ?? false,
      lockReason: extras.lockReason ?? null,
      fetchedAt: new Date().toISOString(),
      updatedAt: policy.updatedAt.toISOString(),
    };
  }
}
