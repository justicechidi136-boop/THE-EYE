import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  effectivePreferredLocale,
  isEnabledPreferredLocale,
  normalizePreferredLocale,
} from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { UpdateAdminPreferencesDto, UpsertPolicyDto } from "./dto/admin-settings.dto";
import {
  buildCommunityScopeKey,
  buildJurisdictionScopeKey,
  buildPlatformScopeKey,
  DEFAULT_POLICY_CONFIG,
  isPolicySection,
  mergePolicyConfig,
  POLICY_SECTIONS,
  type PolicySection,
} from "./policy-defaults";

type ResolvedPolicy = {
  section: PolicySection;
  scopeKey: string;
  version: number;
  config: Record<string, unknown>;
  source: "community" | "jurisdiction" | "platform" | "default";
  updatedAt: string | null;
};

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listPolicies(actor: JwtPayload, communityId?: string) {
    const data = await Promise.all(
      POLICY_SECTIONS.map(async (section) => ({
        section,
        policy: await this.buildResolvedPolicy(section, actor, communityId),
      })),
    );
    return { data };
  }

  async getPolicy(section: string, actor: JwtPayload, communityId?: string) {
    if (!isPolicySection(section)) throw new NotFoundException("Policy section not found");
    return { data: await this.buildResolvedPolicy(section, actor, communityId) };
  }

  async upsertPolicy(section: string, dto: UpsertPolicyDto, actor: JwtPayload) {
    if (!isPolicySection(section)) throw new NotFoundException("Policy section not found");
    this.assertCanManagePolicy(actor, dto.scope ?? "jurisdiction", dto.communityId);
    const scopeKey = this.resolveScopeKey(actor, dto.scope ?? "jurisdiction", dto.communityId);
    const mergedConfig = mergePolicyConfig(section, dto.config);
    const existing = await this.prisma.policyConfiguration.findUnique({
      where: { section_scopeKey: { section, scopeKey } },
    });
    const saved = await this.prisma.policyConfiguration.upsert({
      where: { section_scopeKey: { section, scopeKey } },
      create: {
        section,
        scopeKey,
        config: mergedConfig as never,
        communityId: dto.communityId ?? null,
        updatedByAdminId: actor.sub,
        version: 1,
      },
      update: {
        config: mergedConfig as never,
        communityId: dto.communityId ?? null,
        updatedByAdminId: actor.sub,
        version: (existing?.version ?? 0) + 1,
      },
    });
    await this.audit.record({
      actorType: "admin",
      actorAdminId: actor.sub,
      action: "policy.updated",
      entityType: "policy_configurations",
      entityId: saved.id,
      metadata: { section, scopeKey, version: saved.version, changeReason: dto.changeReason ?? null },
    });
    return {
      data: {
        section,
        scopeKey,
        version: saved.version,
        config: mergedConfig,
        source: scopeKey.startsWith("community:") ? "community" : scopeKey.startsWith("jurisdiction:") ? "jurisdiction" : "platform",
        updatedAt: saved.updatedAt.toISOString(),
      },
    };
  }

  async getPreferences(actor: JwtPayload) {
    const prefs = await this.prisma.adminUserPreference.findUnique({ where: { adminUserId: actor.sub } });
    return {
      data: {
        theme: prefs?.theme ?? "system",
        notificationPrefs: (prefs?.notificationPrefs as Record<string, unknown> | null) ?? {},
        preferredLocale: prefs?.preferredLocale ?? null,
        effectivePreferredLocale: effectivePreferredLocale(prefs?.preferredLocale),
      },
    };
  }

  async updatePreferences(actor: JwtPayload, dto: UpdateAdminPreferencesDto) {
    const preferredLocale = this.normalizePreferredLocale(dto.preferredLocale);
    const saved = await this.prisma.adminUserPreference.upsert({
      where: { adminUserId: actor.sub },
      create: {
        adminUserId: actor.sub,
        theme: dto.theme ?? "system",
        notificationPrefs: (dto.notificationPrefs ?? {}) as never,
        preferredLocale: preferredLocale ?? null,
      },
      update: {
        theme: dto.theme ?? undefined,
        preferredLocale,
        notificationPrefs: dto.notificationPrefs ? (dto.notificationPrefs as never) : undefined,
      },
    });
    return {
      data: {
        theme: saved.theme,
        notificationPrefs: saved.notificationPrefs,
        preferredLocale: saved.preferredLocale ?? null,
        effectivePreferredLocale: effectivePreferredLocale(saved.preferredLocale),
      },
    };
  }

  async resolvePolicyConfig(section: PolicySection, actor: JwtPayload, communityId?: string) {
    const resolved = await this.buildResolvedPolicy(section, actor, communityId);
    return resolved.config;
  }

  private async buildResolvedPolicy(section: PolicySection, actor: JwtPayload, communityId?: string): Promise<ResolvedPolicy> {
    const scopeKeys = [
      communityId ? buildCommunityScopeKey(communityId) : null,
      buildJurisdictionScopeKey(actor.country ?? "*", actor.state ?? "*", actor.lga ?? "*"),
      buildPlatformScopeKey(),
    ].filter(Boolean) as string[];

    const rows = await this.prisma.policyConfiguration.findMany({
      where: { section, scopeKey: { in: scopeKeys }, isActive: true },
    });
    const byScope = new Map(rows.map((row) => [row.scopeKey, row]));
    for (const scopeKey of scopeKeys) {
      const match = byScope.get(scopeKey);
      if (match) {
        return {
          section,
          scopeKey,
          version: match.version,
          config: mergePolicyConfig(section, match.config as Record<string, unknown>),
          source: scopeKey.startsWith("community:") ? "community" : scopeKey.startsWith("jurisdiction:") ? "jurisdiction" : "platform",
          updatedAt: match.updatedAt.toISOString(),
        };
      }
    }
    return {
      section,
      scopeKey: scopeKeys[scopeKeys.length - 1] ?? buildPlatformScopeKey(),
      version: 0,
      config: DEFAULT_POLICY_CONFIG[section],
      source: "default",
      updatedAt: null,
    };
  }

  private resolveScopeKey(actor: JwtPayload, scope: "platform" | "jurisdiction" | "community", communityId?: string) {
    if (scope === "community") {
      if (!communityId) throw new ForbiddenException("communityId is required for community policy scope");
      return buildCommunityScopeKey(communityId);
    }
    if (scope === "platform") {
      if (actor.role !== "Super Admin") throw new ForbiddenException("Only Super Admin can edit platform policies");
      return buildPlatformScopeKey();
    }
    return buildJurisdictionScopeKey(actor.country ?? "*", actor.state ?? "*", actor.lga ?? "*");
  }

  private assertCanManagePolicy(actor: JwtPayload, scope: "platform" | "jurisdiction" | "community", communityId?: string) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can manage policies");
    if (scope === "platform" && actor.role !== "Super Admin") {
      throw new ForbiddenException("Only Super Admin can manage platform policies");
    }
    if (scope === "community" && !communityId) {
      throw new ForbiddenException("communityId is required for community policy scope");
    }
  }

  private normalizePreferredLocale(value: string | null | undefined) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const normalized = normalizePreferredLocale(value);
    if (normalized !== null && !isEnabledPreferredLocale(normalized)) {
      throw new BadRequestException("Unsupported preferredLocale");
    }
    return normalized;
  }
}
