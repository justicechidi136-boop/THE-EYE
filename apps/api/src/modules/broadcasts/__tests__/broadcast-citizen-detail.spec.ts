import { NotFoundException } from "@nestjs/common";
import { BroadcastStatus } from "@the-eye/shared";
import { createMetricsMock } from "../../../common/metrics/metrics.test-utils";
import { BroadcastsService } from "../broadcasts.service";

function buildService(prisma: Record<string, unknown>) {
  return new BroadcastsService(
    prisma as any,
    { enqueue: jest.fn() } as any,
    { record: jest.fn() } as any,
    createMetricsMock(),
    { getHealth: jest.fn() } as any,
  );
}

describe("BroadcastsService.getForCitizen", () => {
  const citizen = { typ: "user", sub: "11111111-1111-4111-8111-111111111111", permissions: ["incident:read"] };

  it("rejects non-uuid broadcast ids without querying", async () => {
    const prisma = { $queryRawUnsafe: jest.fn() };
    const service = buildService(prisma);
    await expect(service.getForCitizen("not-a-uuid", citizen as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("allows prior delivery recipients to open resolved broadcasts from notifications", async () => {
    const broadcastId = "22222222-2222-4222-8222-222222222222";
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        {
          id: broadcastId,
          type: "MissingPerson",
          title: "Missing person: Ada",
          body: "Found update body",
          priority: "P2ActiveCrimeAccident",
          status: BroadcastStatus.Resolved,
          author_type: "Citizen",
          admin_verified: true,
          country: "NG",
          state: "Lagos",
          published_at: new Date("2026-08-01T00:00:00.000Z"),
          expires_at: new Date("2026-07-01T00:00:00.000Z"),
          metadata: {},
          creator_user_id: "33333333-3333-4333-8333-333333333333",
          comments_count: 0,
          read: false,
        },
      ]),
    };
    const service = buildService(prisma);
    const result = await service.getForCitizen(broadcastId, citizen as any);
    expect(result.data.id).toBe(broadcastId);
    expect(result.data.status).toBe(BroadcastStatus.Resolved);
    expect(String(prisma.$queryRawUnsafe.mock.calls[0]?.[0])).toContain("broadcast_deliveries");
    expect(String(prisma.$queryRawUnsafe.mock.calls[0]?.[0])).toContain("creator_user_id");
    expect(String(prisma.$queryRawUnsafe.mock.calls[0]?.[0])).toContain("DeletedByAdmin");
  });

  it("returns not found when citizen has no access row", async () => {
    const prisma = { $queryRawUnsafe: jest.fn().mockResolvedValue([]) };
    const service = buildService(prisma);
    await expect(
      service.getForCitizen("22222222-2222-4222-8222-222222222222", citizen as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
