import { installJsonSafePrototypes, toJsonSafe } from "../../../common/serialization/json-safe";
import { AuditService } from "../audit.service";

installJsonSafePrototypes();

function buildService() {
  const created: any[] = [];
  const prisma = {
    auditLog: {
      findFirst: jest.fn(async () => created[created.length - 1] ?? null),
      create: jest.fn(async ({ data }) => {
        created.push(data);
        return data;
      }),
      findMany: jest.fn(async () => created),
    },
  } as any;
  return { service: new AuditService(prisma), prisma, created };
}

describe("AuditService", () => {
  it("creates a tamper-evident hash chain", async () => {
    const { service, created } = buildService();
    const first = await service.record({ action: "incident.created", entityType: "incidents", entityId: "11111111-1111-1111-1111-111111111111" });
    const second = await service.record({ action: "incident.viewed", entityType: "incidents", entityId: "11111111-1111-1111-1111-111111111111" });

    expect(first.eventHash).toHaveLength(64);
    expect(second.previousHash).toBe(first.eventHash);
    expect(created[1].sequence).toBe(2n);
  });

  it("reports a broken chain", async () => {
    const { service, created } = buildService();
    await service.record({ action: "incident.created", entityType: "incidents" });
    await service.record({ action: "incident.viewed", entityType: "incidents" });
    created[1].previousHash = "tampered";

    const result = await service.verifyChain();
    expect(result.verified).toBe(false);
    expect(result.broken[0].reason).toBe("previous_hash_mismatch");
  });

  it("returns audit rows that become JSON-safe via centralized serialization", async () => {
    const { service, prisma } = buildService();
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: "a1",
        sequence: 42n,
        action: "admin.login",
        entityType: "admins",
        eventHash: "abc",
      },
    ]);

    const page = await service.list(
      { sub: "admin-1", typ: "admin", role: "SuperAdmin", permissions: ["audit:read"] } as never,
      {},
      { limit: 10 },
    );

    expect(page.data[0]?.sequence).toBe(42n);
    expect(() => JSON.stringify(page)).not.toThrow();
    expect(toJsonSafe(page).data[0]?.sequence).toBe("42");
  });
});
