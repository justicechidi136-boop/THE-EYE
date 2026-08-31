import { NotFoundException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { LocationSearchQueryDto } from "../dto/location-query.dto";
import { LocationsService } from "../locations.service";

describe("LocationsService", () => {
  function buildService() {
    const prisma = {
      country: { findFirst: jest.fn() },
      administrativeState: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      localGovernmentArea: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      ward: { findMany: jest.fn(), count: jest.fn() },
    };
    return { prisma, service: new LocationsService(prisma as never) };
  }

  it("lists Nigeria States/FCT with server-side pagination", async () => {
    const { prisma, service } = buildService();
    prisma.country.findFirst.mockResolvedValue({ id: "country-1" });
    prisma.administrativeState.findMany.mockResolvedValue([
      { id: "state-1", code: "24", name: "Lagos", type: "STATE" },
    ]);
    prisma.administrativeState.count.mockResolvedValue(37);

    const result = await service.listStates("ng", { page: 1, limit: 20 });

    expect(result.data[0].name).toBe("Lagos");
    expect(result.pagination.total).toBe(37);
    expect(prisma.administrativeState.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it("lists only LGAs belonging to the requested State", async () => {
    const { prisma, service } = buildService();
    prisma.administrativeState.findFirst.mockResolvedValue({
      id: "state-1",
      name: "Lagos",
      country: { code: "NG", name: "Nigeria" },
    });
    prisma.localGovernmentArea.findMany.mockResolvedValue([
      { id: "lga-1", code: "16", name: "Ikeja", type: "LGA" },
    ]);
    prisma.localGovernmentArea.count.mockResolvedValue(1);

    const result = await service.listLgas("state-1", { page: 1, limit: 50 });

    expect(result.data[0]).toEqual(expect.objectContaining({ name: "Ikeja", state: "Lagos" }));
    expect(prisma.localGovernmentArea.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ stateId: "state-1" }) }),
    );
  });

  it("returns each Ward with its complete hierarchy", async () => {
    const { prisma, service } = buildService();
    prisma.localGovernmentArea.findFirst.mockResolvedValue({
      id: "lga-1",
      name: "Ikeja",
      state: { name: "Lagos", country: { name: "Nigeria" } },
    });
    prisma.ward.findMany.mockResolvedValue([
      { id: "ward-1", code: "01", name: "Airport/Onipetesi/Inilekere" },
    ]);
    prisma.ward.count.mockResolvedValue(1);

    const result = await service.listWards("lga-1", { page: 1, limit: 50 });

    expect(result.data[0]).toEqual(
      expect.objectContaining({ lga: "Ikeja", state: "Lagos", country: "Nigeria" }),
    );
  });

  it("rejects an invalid parent instead of returning an ambiguous empty list", async () => {
    const { prisma, service } = buildService();
    prisma.administrativeState.findFirst.mockResolvedValue(null);

    await expect(service.listLgas("missing", { page: 1, limit: 50 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("uses authoritative counts for combined hierarchy search pagination", async () => {
    const { prisma, service } = buildService();
    prisma.administrativeState.findMany.mockResolvedValue([
      { id: "state-1", name: "Cross River", type: "STATE", country: { name: "Nigeria" } },
    ]);
    prisma.localGovernmentArea.findMany.mockResolvedValue([]);
    prisma.ward.findMany.mockResolvedValue([]);
    prisma.administrativeState.count.mockResolvedValue(1);
    prisma.localGovernmentArea.count.mockResolvedValue(2);
    prisma.ward.count.mockResolvedValue(65);

    const result = await service.search({ q: "Cross", page: 1, limit: 20 });

    expect(result.pagination.total).toBe(68);
    expect(result.pagination.hasNext).toBe(true);
  });

  it("bounds public hierarchy search pages", () => {
    const query = plainToInstance(LocationSearchQueryDto, { q: "Lagos", page: 101, limit: 100 });

    expect(validateSync(query).length).toBe(1);
  });
});
