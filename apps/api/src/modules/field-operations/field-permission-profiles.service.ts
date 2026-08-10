import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { FIELD_PERM_ERROR_CODES, FieldOperationalRole, type Permission } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { FieldDevicesAdminService } from "./field-devices-admin.service";
import { FieldPermissionPolicyService } from "./field-permission-policy.service";
import type {
  CreateFieldPermissionProfileDto,
  DisableFieldPermissionProfileDto,
  FieldPermissionEffectivePreviewQuery,
  FieldPermissionProfileListQuery,
  UpdateFieldPermissionProfileDto,
} from "./dto/field-permission-profiles.dto";

const CODE_PATTERN = /^[a-z][a-z0-9_-]{2,63}$/;
const OPERATIONAL_ROLES = new Set<string>(Object.values(FieldOperationalRole));

@Injectable()
export class FieldPermissionProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly devicesAdmin: FieldDevicesAdminService,
    private readonly policy: FieldPermissionPolicyService,
  ) {}

  async list(actor: JwtPayload, query: FieldPermissionProfileListQuery) {
    this.devicesAdmin.assertSupervisor(actor);
    const rows = await this.prisma.fieldPermissionProfile.findMany({
      where: {
        ...(query.isActive != null ? { isActive: query.isActive === "true" } : {}),
        ...(query.operationalRole ? { operationalRole: query.operationalRole } : {}),
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
    return { data: rows.map((row) => this.mapProfile(row)) };
  }

  async get(id: string, actor: JwtPayload) {
    this.devicesAdmin.assertSupervisor(actor);
    const profile = await this.requireProfile(id);
    return { data: this.mapProfile(profile) };
  }

  async create(actor: JwtPayload, dto: CreateFieldPermissionProfileDto) {
    this.devicesAdmin.assertSupervisor(actor);
    this.validateCode(dto.code);
    if (!dto.name?.trim()) throw new BadRequestException("Profile name is required");
    if (dto.operationalRole && !OPERATIONAL_ROLES.has(dto.operationalRole)) {
      throw new BadRequestException(`Unknown operationalRole: ${dto.operationalRole}`);
    }
    if (!Array.isArray(dto.permissions) || dto.permissions.length === 0) {
      throw new BadRequestException("At least one permission is required");
    }
    const permissions = this.policy.validateGrant(actor, dto.permissions);

    const existing = await this.prisma.fieldPermissionProfile.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException(`Profile code "${dto.code}" already exists`);

    const profile = await this.prisma.fieldPermissionProfile.create({
      data: {
        code: dto.code,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        operationalRole: dto.operationalRole ?? null,
        permissions,
        isSystem: false,
        isActive: true,
        createdById: actor.sub,
        updatedById: actor.sub,
      },
    });

    await this.audit.record({
      actor,
      action: "field.permission_profile.created",
      entityType: "field_permission_profile",
      entityId: profile.id,
      metadata: { code: profile.code, permissions },
    });

    return { data: this.mapProfile(profile) };
  }

  async update(id: string, actor: JwtPayload, dto: UpdateFieldPermissionProfileDto) {
    this.devicesAdmin.assertSupervisor(actor);
    const profile = await this.requireProfile(id);
    if (profile.isSystem) {
      throw new BadRequestException("System profiles are read-only — disable it and create a custom profile instead");
    }
    if (dto.operationalRole && !OPERATIONAL_ROLES.has(dto.operationalRole)) {
      throw new BadRequestException(`Unknown operationalRole: ${dto.operationalRole}`);
    }
    const permissions = dto.permissions ? this.policy.validateGrant(actor, dto.permissions) : undefined;
    if (dto.permissions && (!Array.isArray(dto.permissions) || dto.permissions.length === 0)) {
      throw new BadRequestException("At least one permission is required");
    }

    const updated = await this.prisma.fieldPermissionProfile.update({
      where: { id: profile.id },
      data: {
        name: dto.name?.trim() || undefined,
        description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
        operationalRole: dto.operationalRole ?? undefined,
        permissions,
        updatedById: actor.sub,
      },
    });

    await this.audit.record({
      actor,
      action: "field.permission_profile.updated",
      entityType: "field_permission_profile",
      entityId: profile.id,
      metadata: { code: profile.code, permissions: permissions ?? profile.permissions },
    });

    return { data: this.mapProfile(updated) };
  }

  async disable(id: string, actor: JwtPayload, dto: DisableFieldPermissionProfileDto) {
    this.devicesAdmin.assertSupervisor(actor);
    const profile = await this.requireProfile(id);
    if (!profile.isActive) return { data: this.mapProfile(profile) };

    const updated = await this.prisma.fieldPermissionProfile.update({
      where: { id: profile.id },
      data: {
        isActive: false,
        disabledAt: new Date(),
        disabledById: actor.sub,
        disabledReason: dto.reason ?? null,
      },
    });

    await this.audit.record({
      actor,
      action: "field.permission_profile.disabled",
      entityType: "field_permission_profile",
      entityId: profile.id,
      reason: dto.reason,
      metadata: { code: profile.code },
    });

    return { data: this.mapProfile(updated) };
  }

  /** Dry-run: resolves the effective permission set + authority check without persisting anything. */
  async previewEffective(actor: JwtPayload, query: FieldPermissionEffectivePreviewQuery) {
    this.devicesAdmin.assertSupervisor(actor);

    let profilePermissions: Permission[] = [];
    let profileSummary: { id: string; code: string; name: string } | null = null;
    if (query.profileId) {
      const profile = await this.requireProfile(query.profileId);
      profilePermissions = (profile.permissions as Permission[]) ?? [];
      profileSummary = { id: profile.id, code: profile.code, name: profile.name };
    }

    const overrides = query.overrides ? this.policy.assertKnownPermissions(this.splitCsv(query.overrides)) : [];
    const denies = query.denies ? this.policy.assertKnownPermissions(this.splitCsv(query.denies)) : [];
    const effective = this.policy.resolveEffective(profilePermissions, overrides, denies);
    const authority = this.policy.checkAuthority(actor, effective);

    return {
      data: {
        profile: profileSummary,
        profilePermissions,
        overrides,
        denies,
        effectivePermissions: effective,
        withinAuthority: authority.allowed,
        excessPermissions: authority.excess,
        actorCeiling: authority.ceiling,
      },
    };
  }

  private splitCsv(value: string): string[] {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  /** Loads an *active* profile for assignment to a device — used by preprovision/pairing services. */
  async requireActiveProfile(id: string) {
    const profile = await this.requireProfile(id);
    if (!profile.isActive) {
      throw new ForbiddenException({
        code: FIELD_PERM_ERROR_CODES.PROFILE_INACTIVE,
        message: "Permission profile is disabled",
      });
    }
    return profile;
  }

  private async requireProfile(id: string) {
    const profile = await this.prisma.fieldPermissionProfile.findUnique({ where: { id } });
    if (!profile) {
      throw new NotFoundException({ code: FIELD_PERM_ERROR_CODES.PROFILE_NOT_FOUND, message: "Permission profile not found" });
    }
    return profile;
  }

  private validateCode(code: string) {
    if (!code || !CODE_PATTERN.test(code)) {
      throw new BadRequestException("code must be lowercase, start with a letter, and use letters/numbers/-/_ only (3-64 chars)");
    }
  }

  mapProfile(profile: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    operationalRole: string | null;
    compatibleAgencyTypes?: string[];
    permissions: unknown;
    isSystem: boolean;
    isActive: boolean;
    disabledAt: Date | null;
    disabledReason: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: profile.id,
      code: profile.code,
      name: profile.name,
      description: profile.description,
      operationalRole: profile.operationalRole,
      compatibleAgencyTypes: Array.isArray(profile.compatibleAgencyTypes) ? profile.compatibleAgencyTypes : [],
      permissions: Array.isArray(profile.permissions) ? profile.permissions : [],
      isSystem: profile.isSystem,
      isActive: profile.isActive,
      disabledAt: profile.disabledAt?.toISOString() ?? null,
      disabledReason: profile.disabledReason,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}
