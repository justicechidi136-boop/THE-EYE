import { BadRequestException } from "@nestjs/common";
import { IncidentsService } from "../incidents.service";
import { encodeDateIdCursor } from "../../../common/pagination/cursor-pagination";

function createListService() {
  const prisma = {
    incident: {
      findMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
  };
  const service = Object.create(IncidentsService.prototype) as IncidentsService;
  Object.assign(service, {
    prisma,
    incidentScopeWhere: jest.fn().mockReturnValue({ country: "Nigeria" }),
  });
  return { service, prisma };
}

describe("IncidentsService.list pagination", () => {
  it("lists the first page without a cursor", async () => {
    const { service, prisma } = createListService();
    const rows = [
      { id: "2", createdAt: new Date("2026-07-09T12:00:00.000Z"), priority: "P2ActiveCrimeAccident" },
      { id: "1", createdAt: new Date("2026-07-09T11:00:00.000Z"), priority: "P1LifeThreatening" },
    ];
    prisma.incident.findMany.mockResolvedValue(rows);

    const page = await service.list(undefined, {}, { limit: "100" });

    expect(page.data).toHaveLength(2);
    expect(page.hasMore).toBe(false);
    expect(prisma.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ country: "Nigeria" }, {}, {}, {}] },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 101,
      }),
    );
  });

  it("lists subsequent pages using createdAt/id keyset filters", async () => {
    const { service, prisma } = createListService();
    const cursor = encodeDateIdCursor("2026-07-09T12:00:00.000Z", "cursor-id");
    prisma.incident.findMany.mockResolvedValue([
      { id: "older", createdAt: new Date("2026-07-09T11:00:00.000Z"), priority: "P4GeneralSafety" },
    ]);

    await service.list(undefined, { status: "Submitted", priority: "P1LifeThreatening" }, { cursor, limit: "100" });

    expect(prisma.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { country: "Nigeria" },
            { status: "Submitted", priority: "P1LifeThreatening" },
            {},
            {
              OR: [
                { createdAt: { lt: new Date("2026-07-09T12:00:00.000Z") } },
                { createdAt: new Date("2026-07-09T12:00:00.000Z"), id: { lt: "cursor-id" } },
              ],
            },
          ],
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 101,
      }),
    );
  });

  it("supports numbered Admin pages with an authoritative total", async () => {
    const { service, prisma } = createListService();
    prisma.incident.findMany.mockResolvedValue([{ id: "page-two", createdAt: new Date(), priority: "P2ActiveCrimeAccident" }]);
    prisma.incident.count.mockResolvedValueOnce(41).mockResolvedValueOnce(20).mockResolvedValueOnce(4).mockResolvedValueOnce(3);

    const result = await service.list(undefined, {}, { page: "2", limit: "20" });

    expect(result).toEqual(expect.objectContaining({ page: 2, totalPages: 3, limit: 20, hasMore: true }));
    expect(prisma.incident.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20 }));
  });

  it("rejects mixed cursor and numbered pagination", async () => {
    const { service, prisma } = createListService();
    await expect(service.list(undefined, {}, { page: "2", cursor: "opaque" })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.incident.findMany).not.toHaveBeenCalled();
  });

  it("returns HTTP 400 for malformed cursors instead of Prisma 500", async () => {
    const { service, prisma } = createListService();

    await expect(service.list(undefined, {}, { cursor: "not-valid", limit: "100" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.incident.findMany).not.toHaveBeenCalled();
  });

  it("encodes nextCursor from createdAt and id only", async () => {
    const { service, prisma } = createListService();
    const lastPageCreatedAt = new Date("2026-07-09T11:00:00.000Z");
    prisma.incident.findMany.mockResolvedValue([
      { id: "page-2", createdAt: new Date("2026-07-09T12:00:00.000Z"), priority: "P1LifeThreatening" },
      { id: "page-1", createdAt: lastPageCreatedAt, priority: "P4GeneralSafety" },
      { id: "extra", createdAt: new Date("2026-07-09T10:00:00.000Z"), priority: "P3SuspiciousActivity" },
    ]);

    const page = await service.list(undefined, {}, { limit: "2" });

    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe(encodeDateIdCursor(lastPageCreatedAt, "page-1"));
  });

  it("searches the complete scoped result and returns authoritative metrics", async () => {
    const { service, prisma } = createListService();
    prisma.incident.findMany.mockResolvedValue([]);
    prisma.incident.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);

    const page = await service.list(undefined, { q: "Ada" }, { limit: "100" });

    expect(page.meta).toEqual({ totalReports: 12, activeReports: 8, criticalReports: 3, verifyingReports: 2 });
    expect(prisma.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { title: { contains: "Ada", mode: "insensitive" } },
                { reporter: { profile: { firstName: { contains: "Ada", mode: "insensitive" } } } },
              ]),
            }),
          ]),
        }),
      }),
    );
  });
});
