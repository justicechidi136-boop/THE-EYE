import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import {
  AGENCY_ERROR_CODES,
  FIELD_ERROR_CODES,
  FieldActivationPolicy,
  FieldDeviceRegistrationStatus,
  FieldOperationalRole,
  FieldPreProvisionStatus,
  FieldProvisioningMode,
  isFieldEligibleAdminRole,
  type Permission,
} from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { randomToken } from "../../common/auth/crypto";
import { AgenciesService } from "../agencies/agencies.service";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { FieldDevicesAdminService } from "./field-devices-admin.service";
import { FieldDevicesService } from "./field-devices.service";
import { FieldPermissionPolicyService } from "./field-permission-policy.service";
import { FieldPermissionProfilesService } from "./field-permission-profiles.service";
import type {
  PreProvisionFieldDeviceDto,
  UpdateFieldDeviceProvisioningDto,
} from "./dto/field-device-preprovision.dto";

const ACTIVATION_POLICIES = new Set<string>(Object.values(FieldActivationPolicy));
const DEVICE_MODES = new Set(["standard", "launcher", "managed_kiosk"]);
const OPERATIONAL_ROLES = new Set<string>(Object.values(FieldOperationalRole));
const EDITABLE_PRE_PROVISION_STATUSES = new Set<string>([
  FieldPreProvisionStatus.Draft,
  FieldPreProvisionStatus.AwaitingPairing,
]);

/**
 * Admin-side workflow for creating and editing unbound ("pre-provisioned") field
 * devices ahead of physical hand-off, so a device record — including its permission
 * profile and authority snapshot — exists before an officer ever unboxes the tablet.
 * This is purely additive: tablet-initiated self-registration (FieldDevicesService)
 * is untouched and remains the default `provisioningMode`.
 */
@Injectable()
export class FieldDevicePreprovisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly devices: FieldDevicesService,
    private readonly devicesAdmin: FieldDevicesAdminService,
    private readonly profiles: FieldPermissionProfilesService,
    private readonly policy: FieldPermissionPolicyService,
    private readonly agencies: AgenciesService,
  ) {}

  async preprovision(actor: JwtPayload, dto: PreProvisionFieldDeviceDto) {
    this.devicesAdmin.assertSupervisor(actor);
    if (!dto.deviceName?.trim()) throw new BadRequestException("deviceName is required");
    if (dto.operationalRole && !OPERATIONAL_ROLES.has(dto.operationalRole)) {
      throw new BadRequestException(`Unknown operationalRole: ${dto.operationalRole}`);
    }
    const deviceMode = this.validateDeviceMode(dto.deviceMode) ?? null;
    const activationPolicy = this.validateActivationPolicy(dto.activationPolicy);
    const activationExpiresAt = this.parseDate(dto.activationExpiresAt, "activationExpiresAt", { futureOnly: true });
    const reviewAt = this.parseDate(dto.reviewAt, "reviewAt", { futureOnly: false });
    const scope = this.resolveScope(actor, dto);

    if (!scope.agencyId) {
      throw new BadRequestException({
        code: AGENCY_ERROR_CODES.NOT_FOUND,
        message: "agencyId is required for field device pre-provisioning",
      });
    }

    let permissionProfileId: string | null = null;
    let profileCode: string | null = null;
    let grantedPermissions: Permission[] = [];
    let compatibleAgencyTypes: string[] = [];
    if (dto.permissionProfileId) {
      const profile = await this.profiles.requireActiveProfile(dto.permissionProfileId);
      grantedPermissions = this.policy.validateGrant(actor, profile.permissions as string[]);
      permissionProfileId = profile.id;
      profileCode = profile.code;
      compatibleAgencyTypes = (profile as { compatibleAgencyTypes?: string[] }).compatibleAgencyTypes ?? [];
    }

    const agency = await this.agencies.assertFieldOperationsAssignment({
      actor,
      agencyId: scope.agencyId,
      assignedUnitId: dto.assignedUnitId,
      operationalRole: dto.operationalRole,
      permissionProfileId,
      compatibleAgencyTypes,
    });

    const assignedUserId = dto.assignedUserId
      ? (await this.requireAssignableUser(dto.assignedUserId, agency)).id
      : null;
    const inventoryAssetRef = dto.inventoryAssetRef?.trim() || null;
    if (inventoryAssetRef) {
      const duplicate = await this.prisma.fieldDevice.findFirst({
        where: { inventoryAssetRef: { equals: inventoryAssetRef, mode: "insensitive" } },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException("Inventory asset reference is already assigned to another device");
    }

    const overrides = dto.permissionOverrides?.length ? this.policy.validateGrant(actor, dto.permissionOverrides) : [];
    const denies = dto.permissionDenies?.length ? this.policy.assertKnownPermissions(dto.permissionDenies) : [];

    const authoritySnapshot = this.policy.buildAuthoritySnapshot({
      actor,
      profileId: permissionProfileId,
      profileCode,
      grantedPermissions,
      overrides,
      denies,
    });

    const publicDeviceId = `fd_${randomToken(12)}`;
    let device;
    try {
      device = await this.prisma.fieldDevice.create({
        data: {
        publicDeviceId,
        deviceName: dto.deviceName.trim(),
        provisioningMode: FieldProvisioningMode.PreProvisioned,
        registrationStatus: FieldDeviceRegistrationStatus.PendingApproval,
        preProvisionStatus: FieldPreProvisionStatus.Draft,
        provisionedAt: new Date(),
        provisionedById: actor.sub,
        permissionProfileId,
        assignedTeamId: dto.assignedTeamId?.trim() || null,
        assignedUserId,
        assignedUnitId: dto.assignedUnitId ?? null,
        operationalRole: dto.operationalRole ?? null,
        deviceMode,
        activationPolicy,
        activationExpiresAt,
        reviewAt,
        notes: dto.notes?.trim() || null,
        inventoryAssetRef,
        permissionOverrides: overrides,
        permissionDenies: denies,
        authoritySnapshot: authoritySnapshot as never,
        agencyId: agency.id,
        countryCode: scope.countryCode ?? agency.countryCode ?? undefined,
        stateCode: scope.stateCode ?? agency.stateCode ?? undefined,
        lgaCode: scope.lgaCode ?? agency.lgaCode ?? undefined,
        metadata: {},
        },
      });
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      if (code === "P2002") throw new ConflictException("A device with this identifier already exists");
      if (code === "P2003" || code === "P2023") {
        throw new BadRequestException("One or more device assignments are invalid");
      }
      throw error;
    }

    await this.audit.record({
      actor,
      action: "field.device.preprovisioned",
      entityType: "field_device",
      entityId: device.id,
      metadata: {
        publicDeviceId,
        permissionProfileId,
        operationalRole: dto.operationalRole ?? null,
        activationPolicy,
      },
    });

    return { data: this.devices.mapDevice(device) };
  }

  async listAssignableUsers(actor: JwtPayload, agencyId?: string) {
    this.devicesAdmin.assertSupervisor(actor);
    if (!agencyId) throw new BadRequestException("agencyId is required");
    const agency = await this.agencies.assertFieldOperationsAssignment({ actor, agencyId });
    const rows = await this.prisma.adminUser.findMany({
      where: {
        isActive: true,
        country: agency.countryCode,
        ...(agency.stateCode ? { state: agency.stateCode } : {}),
        ...(agency.lgaCode ? { lga: agency.lgaCode } : {}),
        OR: [{ agencyId: agency.id }, { agencyId: null }],
      },
      select: {
        id: true,
        displayName: true,
        agencyId: true,
        country: true,
        state: true,
        lga: true,
        role: { select: { name: true } },
      },
      orderBy: { displayName: "asc" },
      take: 200,
    });
    return {
      data: rows
        .filter((row) => isFieldEligibleAdminRole(row.role.name))
        .map((row) => ({
          id: row.id,
          displayName: row.displayName,
          role: row.role.name,
          agencyId: row.agencyId,
          scope: [row.country, row.state, row.lga].filter(Boolean).join(" / "),
        })),
    };
  }

  async getProvisioning(id: string, actor: JwtPayload) {
    this.devicesAdmin.assertSupervisor(actor);
    const device = await this.devicesAdmin.requireScopedDevice(id, actor);
    return { data: this.devices.mapDevice(device) };
  }

  async updateProvisioning(id: string, actor: JwtPayload, dto: UpdateFieldDeviceProvisioningDto) {
    this.devicesAdmin.assertSupervisor(actor);
    const device = await this.devicesAdmin.requireScopedDevice(id, actor);
    if (device.provisioningMode !== FieldProvisioningMode.PreProvisioned) {
      throw new BadRequestException("Only pre-provisioned devices can be edited through this endpoint");
    }
    if (!EDITABLE_PRE_PROVISION_STATUSES.has(device.preProvisionStatus ?? "")) {
      throw new BadRequestException("Provisioning can only be edited before pairing completes — cancel and re-issue instead");
    }
    if (dto.operationalRole && !OPERATIONAL_ROLES.has(dto.operationalRole)) {
      throw new BadRequestException(`Unknown operationalRole: ${dto.operationalRole}`);
    }

    const deviceMode = dto.deviceMode !== undefined ? this.validateDeviceMode(dto.deviceMode ?? undefined) ?? null : undefined;
    const activationPolicy = dto.activationPolicy !== undefined ? this.validateActivationPolicy(dto.activationPolicy) : undefined;
    const activationExpiresAt =
      dto.activationExpiresAt !== undefined
        ? this.parseDate(dto.activationExpiresAt ?? undefined, "activationExpiresAt", { futureOnly: true })
        : undefined;
    const reviewAt =
      dto.reviewAt !== undefined ? this.parseDate(dto.reviewAt ?? undefined, "reviewAt", { futureOnly: false }) : undefined;

    let permissionProfileId: string | null | undefined;
    if (dto.permissionProfileId !== undefined) {
      if (dto.permissionProfileId === null) {
        permissionProfileId = null;
      } else {
        const profile = await this.profiles.requireActiveProfile(dto.permissionProfileId);
        this.policy.validateGrant(actor, profile.permissions as string[]);
        permissionProfileId = profile.id;
      }
    }

    const overrides = dto.permissionOverrides ? this.policy.validateGrant(actor, dto.permissionOverrides) : undefined;
    const denies = dto.permissionDenies ? this.policy.assertKnownPermissions(dto.permissionDenies) : undefined;

    const updated = await this.prisma.fieldDevice.update({
      where: { id: device.id },
      data: {
        operationalRole: dto.operationalRole ?? undefined,
        permissionProfileId,
        assignedTeamId: dto.assignedTeamId !== undefined ? dto.assignedTeamId?.trim() || null : undefined,
        deviceMode,
        activationPolicy,
        activationExpiresAt,
        reviewAt,
        notes: dto.notes !== undefined ? dto.notes?.trim() || null : undefined,
        inventoryAssetRef: dto.inventoryAssetRef !== undefined ? dto.inventoryAssetRef?.trim() || null : undefined,
        permissionOverrides: overrides,
        permissionDenies: denies,
      },
    });

    await this.audit.record({
      actor,
      action: "field.device.provisioning_updated",
      entityType: "field_device",
      entityId: device.id,
      metadata: { permissionProfileId: updated.permissionProfileId, operationalRole: updated.operationalRole },
    });

    return { data: this.devices.mapDevice(updated) };
  }

  private resolveScope(actor: JwtPayload, dto: PreProvisionFieldDeviceDto) {
    const countryCode = dto.countryCode ?? actor.country ?? null;
    const stateCode = dto.stateCode ?? actor.state ?? null;
    const lgaCode = dto.lgaCode ?? actor.lga ?? null;
    const agencyId = dto.agencyId ?? actor.agencyId ?? null;

    if (actor.role === "Super Admin" || actor.role === "Country Admin") {
      return { countryCode, stateCode, lgaCode, agencyId };
    }
    if (actor.role === "State Admin") {
      if (dto.stateCode && dto.stateCode !== actor.state) this.throwOutOfScope();
      return { countryCode: actor.country ?? countryCode, stateCode: actor.state ?? stateCode, lgaCode, agencyId };
    }
    if (actor.role === "LGA Admin") {
      if ((dto.stateCode && dto.stateCode !== actor.state) || (dto.lgaCode && dto.lgaCode !== actor.lga)) {
        this.throwOutOfScope();
      }
      return {
        countryCode: actor.country ?? countryCode,
        stateCode: actor.state ?? stateCode,
        lgaCode: actor.lga ?? lgaCode,
        agencyId,
      };
    }
    if (actor.role === "Agency Admin") {
      if (dto.agencyId && dto.agencyId !== actor.agencyId) this.throwOutOfScope();
      return {
        countryCode: actor.country ?? countryCode,
        stateCode: actor.state ?? stateCode,
        lgaCode: actor.lga ?? lgaCode,
        agencyId: actor.agencyId ?? agencyId,
      };
    }
    this.throwOutOfScope();
  }

  private async requireAssignableUser(
    id: string,
    agency: { id: string; countryCode: string; stateCode: string | null; lgaCode: string | null },
  ) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException("Selected officer is invalid");
    }
    const user = await this.prisma.adminUser.findUnique({ where: { id }, include: { role: true } });
    if (!user || !user.isActive) throw new BadRequestException("Selected officer was not found or is inactive");
    if (!isFieldEligibleAdminRole(user.role.name)) throw new BadRequestException("Selected user is not eligible for field operations");
    const inScope =
      user.country === agency.countryCode &&
      (!agency.stateCode || user.state === agency.stateCode) &&
      (!agency.lgaCode || user.lga === agency.lgaCode) &&
      (!user.agencyId || user.agencyId === agency.id);
    if (!inScope) this.throwOutOfScope();
    return user;
  }

  private throwOutOfScope(): never {
    throw new ForbiddenException({ code: FIELD_ERROR_CODES.JURISDICTION_MISMATCH, message: "Out of scope" });
  }

  private validateDeviceMode(mode?: string) {
    if (mode === undefined) return undefined;
    if (!DEVICE_MODES.has(mode)) throw new BadRequestException("deviceMode must be standard|launcher|managed_kiosk");
    return mode;
  }

  private validateActivationPolicy(policy?: string): FieldActivationPolicy {
    const value = policy ?? FieldActivationPolicy.RequireSupervisorFinalApproval;
    if (!ACTIVATION_POLICIES.has(value)) {
      throw new BadRequestException(`activationPolicy must be one of: ${Array.from(ACTIVATION_POLICIES).join(", ")}`);
    }
    return value as FieldActivationPolicy;
  }

  private parseDate(value: string | undefined, field: string, options: { futureOnly: boolean }): Date | null {
    if (value == null) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field} must be a valid ISO date`);
    if (options.futureOnly && date.getTime() <= Date.now()) throw new BadRequestException(`${field} must be in the future`);
    return date;
  }
}
