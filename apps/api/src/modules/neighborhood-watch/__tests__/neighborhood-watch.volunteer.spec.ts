import { BadRequestException } from "@nestjs/common";
import { NeighborhoodWatchService } from "../neighborhood-watch.service";

const userActor = {
  typ: "user",
  sub: "user-1",
  permissions: ["community:volunteer"],
} as any;

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    volunteerProfile: {
      upsert: jest.fn().mockResolvedValue({
        id: "volunteer-1",
        userId: "user-1",
        types: ["Doctor"],
      }),
    },
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
  const auditService = { record: jest.fn().mockResolvedValue({ id: "audit-1" }) } as any;
  return {
    service: new NeighborhoodWatchService(
      prisma,
      { report: jest.fn() } as any,
      { create: jest.fn() } as any,
      { enqueue: jest.fn() } as any,
      auditService,
      { findActiveZonesNearPoint: jest.fn().mockResolvedValue([]) } as any,
    ),
    prisma,
    auditService,
  };
}

describe("NeighborhoodWatchService.registerVolunteer", () => {
  it("registers selected volunteer categories", async () => {
    const { service, prisma, auditService } = buildService();
    const response = await service.registerVolunteer(
      {
        communityId: "community-1",
        types: ["Doctor", "FirstAid"],
        latitude: 6.6018,
        longitude: 3.3515,
      },
      userActor,
    );

    expect(prisma.volunteerProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ types: ["Doctor", "FirstAid"] }),
      }),
    );
    expect(response.data.id).toBe("volunteer-1");
    expect(auditService.record).toHaveBeenCalled();
  });

  it("rejects invalid volunteer enum before upsert", async () => {
    const { service, prisma } = buildService();
    await expect(
      service.registerVolunteer({ communityId: "community-1", types: ["Paramedic" as never] }, userActor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.volunteerProfile.upsert).not.toHaveBeenCalled();
  });

  it("rejects empty volunteer category selection", async () => {
    const { service, prisma } = buildService();
    await expect(
      service.registerVolunteer({ communityId: "community-1", types: [] }, userActor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.volunteerProfile.upsert).not.toHaveBeenCalled();
  });
});
