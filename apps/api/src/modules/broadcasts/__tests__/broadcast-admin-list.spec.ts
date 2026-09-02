import { BroadcastAuthorType } from "@the-eye/shared";
import { BroadcastAdminService } from "../broadcast-admin.service";

const superAdmin = {
  typ: "admin",
  sub: "admin-1",
  role: "Super Admin",
  permissions: [],
} as any;

describe("BroadcastAdminService list filters", () => {
  it("combines filters and applies page-relative pagination", async () => {
    const prisma = {
      broadcast: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    } as any;
    const service = new BroadcastAdminService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.list(superAdmin, {
      country: "Nigeria",
      state: "Rivers",
      lga: "Obio-Akpor",
      communityId: "community-1",
      category: "SafetyAlert",
      status: "Active",
      author: "Citizen",
      search: "market road",
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-09-02T23:59:59.999Z",
      page: "3",
      limit: "10",
    });

    expect(prisma.broadcast.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
        where: expect.objectContaining({
          deletedAt: null,
          country: "Nigeria",
          state: "Rivers",
          lga: "Obio-Akpor",
          type: "SafetyAlert",
          status: "Active",
          authorType: BroadcastAuthorType.Citizen,
          metadata: {
            path: ["target", "communityId"],
            equals: "community-1",
          },
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
          AND: expect.any(Array),
        }),
      }),
    );
    expect(prisma.broadcast.count).toHaveBeenCalledWith({
      where: prisma.broadcast.findMany.mock.calls[0][0].where,
    });
  });
});
