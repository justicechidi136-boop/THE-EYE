import { mergePolicyConfig } from "../policy-defaults";
import { AdminSettingsService } from "../admin-settings.service";

function buildService() {
  const stored = new Map<string, { version: number; config: Record<string, unknown>; updatedAt: Date }>();
  const preferences = new Map<
    string,
    {
      adminUserId: string;
      theme: string;
      notificationPrefs: Record<string, unknown>;
      preferredLocale: string | null;
    }
  >();
  const prisma = {
    policyConfiguration: {
      findMany: jest.fn(async ({ where }: any) =>
        [...stored.entries()]
          .filter(([key]) => {
            const [section, scopeKey] = key.split("::");
            return section === where.section && where.scopeKey.in.includes(scopeKey);
          })
          .map(([key, value]) => {
            const [, scopeKey] = key.split("::");
            return { section: where.section, scopeKey, version: value.version, config: value.config, updatedAt: value.updatedAt, isActive: true };
          }),
      ),
      findUnique: jest.fn(async ({ where }: any) => stored.get(`${where.section_scopeKey.section}::${where.section_scopeKey.scopeKey}`) ?? null),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const key = `${where.section_scopeKey.section}::${where.section_scopeKey.scopeKey}`;
        const existing = stored.get(key);
        const next = {
          version: existing ? update.version : create.version,
          config: existing ? update.config : create.config,
          updatedAt: new Date(),
        };
        stored.set(key, next);
        return { id: "policy-1", ...where.section_scopeKey, ...next, updatedAt: next.updatedAt };
      }),
    },
    adminUserPreference: {
      findUnique: jest.fn(async ({ where }: any) => preferences.get(where.adminUserId) ?? null),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = preferences.get(where.adminUserId);
        const saved = existing
          ? {
              ...existing,
              ...(update.theme !== undefined ? { theme: update.theme } : {}),
              ...(update.notificationPrefs !== undefined ? { notificationPrefs: update.notificationPrefs } : {}),
              ...(update.preferredLocale !== undefined ? { preferredLocale: update.preferredLocale } : {}),
            }
          : {
              adminUserId: create.adminUserId,
              theme: create.theme,
              notificationPrefs: create.notificationPrefs,
              preferredLocale: create.preferredLocale,
            };
        preferences.set(where.adminUserId, saved);
        return saved;
      }),
    },
  } as any;
  const audit = { record: jest.fn(async () => undefined) } as any;
  return { service: new AdminSettingsService(prisma, audit), stored, preferences };
}

describe("AdminSettingsService", () => {
  const actor = { typ: "admin", sub: "admin-1", role: "State Admin", country: "Nigeria", state: "Lagos", lga: "Ikeja" } as const;

  it("returns default verification policy when nothing is stored", async () => {
    const { service } = buildService();
    const result = await service.getPolicy("verification", actor as never);
    expect(result.data.config.autoVerifyThreshold).toBe(85);
    expect(result.data.source).toBe("default");
  });

  it("upserts jurisdiction policy and resolves stored values", async () => {
    const { service } = buildService();
    await service.upsertPolicy(
      "verification",
      { scope: "jurisdiction", config: { autoVerifyThreshold: 90 } },
      actor as never,
    );
    const result = await service.getPolicy("verification", actor as never);
    expect(result.data.config.autoVerifyThreshold).toBe(90);
    expect(result.data.source).toBe("jurisdiction");
  });

  it("merges defaults with partial updates", () => {
    const merged = mergePolicyConfig("verification", { autoVerifyThreshold: 92 });
    expect(merged.manualReviewThreshold).toBe(70);
    expect(merged.autoVerifyThreshold).toBe(92);
  });

  it("returns preferredLocale in preferences", async () => {
    const { service, preferences } = buildService();
    preferences.set(actor.sub, {
      adminUserId: actor.sub,
      theme: "dark",
      notificationPrefs: { dispatch: true },
      preferredLocale: "ha",
    });

    const result = await service.getPreferences(actor as never);

    expect(result.data.theme).toBe("dark");
    expect(result.data.notificationPrefs).toEqual({ dispatch: true });
    expect(result.data.preferredLocale).toBe("ha");
    expect(result.data.effectivePreferredLocale).toBe("ha");
  });

  for (const preferredLocale of ["en", "ha", "yo", "ig", "pcm"]) {
    it(`patches supported preferredLocale ${preferredLocale}`, async () => {
      const { service } = buildService();

      const result = await service.updatePreferences(actor as never, {
        preferredLocale,
      });

      expect(result.data.preferredLocale).toBe(preferredLocale);
      expect(result.data.effectivePreferredLocale).toBe(preferredLocale);
    });
  }

  it("normalizes supported preferredLocale values", async () => {
    const { service } = buildService();

    const result = await service.updatePreferences(actor as never, {
      preferredLocale: " YO ",
    });

    expect(result.data.preferredLocale).toBe("yo");
  });

  it("rejects unsupported preferredLocale values", async () => {
    const { service } = buildService();

    await expect(
      service.updatePreferences(actor as never, { preferredLocale: "fr" }),
    ).rejects.toThrow("Unsupported preferredLocale");
  });

  it("preserves preferredLocale when patch omits it", async () => {
    const { service } = buildService();
    await service.updatePreferences(actor as never, { preferredLocale: "ig" });

    const result = await service.updatePreferences(actor as never, {
      theme: "dark",
    });

    expect(result.data.theme).toBe("dark");
    expect(result.data.preferredLocale).toBe("ig");
  });

  it("keeps theme-only patches backward compatible", async () => {
    const { service } = buildService();

    const result = await service.updatePreferences(actor as never, {
      theme: "dark",
    });

    expect(result.data.theme).toBe("dark");
    expect(result.data.notificationPrefs).toEqual({});
    expect(result.data.preferredLocale).toBe(null);
    expect(result.data.effectivePreferredLocale).toBe("en");
  });

  it("keeps notificationPrefs-only patches backward compatible", async () => {
    const { service } = buildService();

    const result = await service.updatePreferences(actor as never, {
      notificationPrefs: { alerts: false },
    });

    expect(result.data.theme).toBe("system");
    expect(result.data.notificationPrefs).toEqual({ alerts: false });
    expect(result.data.preferredLocale).toBe(null);
  });

  it("only updates the authenticated officer preference owner", async () => {
    const { service, preferences } = buildService();
    const other = { ...actor, sub: "admin-2" };
    preferences.set(other.sub, {
      adminUserId: other.sub,
      theme: "system",
      notificationPrefs: {},
      preferredLocale: "yo",
    });

    await service.updatePreferences(actor as never, { preferredLocale: "ha" });

    expect(preferences.get(actor.sub)?.preferredLocale).toBe("ha");
    expect(preferences.get(other.sub)?.preferredLocale).toBe("yo");
  });
});
