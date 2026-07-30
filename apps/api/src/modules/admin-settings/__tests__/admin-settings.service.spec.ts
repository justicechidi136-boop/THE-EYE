import { mergePolicyConfig } from "../policy-defaults";
import { AdminSettingsService } from "../admin-settings.service";

function buildService() {
  const stored = new Map<string, { version: number; config: Record<string, unknown>; updatedAt: Date }>();
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
      findUnique: jest.fn(async () => null),
      upsert: jest.fn(async ({ create }: any) => create),
    },
  } as any;
  const audit = { record: jest.fn(async () => undefined) } as any;
  return { service: new AdminSettingsService(prisma, audit), stored };
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
});
