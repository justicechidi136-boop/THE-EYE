import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { FieldShiftStatus } from "@the-eye/shared";
import type { JwtPayload } from "../../../common/auth/jwt";
import { FieldShiftsService } from "../field-shifts.service";
import { FieldPatrolsService } from "../field-patrols.service";
import { validateStartCheckpointDto, validateOperationalResponseDto, validateOperationalSightingDto } from "../dto/field-workflows.dto";
import { assertFieldSession } from "../field-session.util";

describe("FieldShiftsService", () => {
  const actor: JwtPayload = {
    sub: "officer-1",
    typ: "field",
    fieldDeviceId: "device-1",
    agencyId: "agency-1",
    permissions: ["field:session:operate"],
  };

  function createService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      fieldShift: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      patrolSession: { updateMany: jest.fn() },
      checkpointSession: { updateMany: jest.fn() },
      officerStatus: { upsert: jest.fn() },
      ...overrides,
    };
    const audit = { record: jest.fn() };
    const service = Object.create(FieldShiftsService.prototype) as FieldShiftsService;
    Object.assign(service, { prisma, audit });
    return { service, prisma, audit };
  }

  it("starts shift when none active", async () => {
    const { service, prisma } = createService();
    prisma.fieldShift.findFirst.mockResolvedValue(null);
    prisma.fieldShift.create.mockResolvedValue({
      id: "shift-1",
      status: FieldShiftStatus.Active,
      officerId: actor.sub,
      fieldDeviceId: actor.fieldDeviceId,
      agencyId: actor.agencyId,
      assignedUnitId: null,
      vehicleIdentifier: "UNIT-12",
      requiresSupervisorApproval: false,
      metadata: {},
      startedAt: new Date(),
    });
    prisma.officerStatus.upsert.mockResolvedValue({});

    const result = await service.startShift(actor, { vehicleIdentifier: "UNIT-12" });
    expect(result.data.id).toBe("shift-1");
    expect(result.data.status).toBe(FieldShiftStatus.Active);
  });

  it("rejects field actor without agency", async () => {
    const { service } = createService();
    await expect(
      service.startShift({ ...actor, agencyId: undefined }, { vehicleIdentifier: "UNIT-12" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("FieldPatrolsService", () => {
  const actor: JwtPayload = {
    sub: "officer-1",
    typ: "field",
    fieldDeviceId: "device-1",
    agencyId: "agency-1",
    permissions: ["field:session:operate"],
  };

  it("requires active shift before patrol", async () => {
    const prisma = {
      fieldShift: { findFirst: jest.fn().mockResolvedValue(null) },
      checkpointSession: { findFirst: jest.fn().mockResolvedValue(null) },
      patrolSession: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = Object.create(FieldPatrolsService.prototype) as FieldPatrolsService;
    Object.assign(service, { prisma, audit: { record: jest.fn() } });
    await expect(service.startPatrol(actor, { patrolZoneLabel: "Zone A" })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("FieldCheckpointsService", () => {
  it("requires checkpoint name", () => {
    expect(() => validateStartCheckpointDto({ checkpointName: "  " })).toThrow(BadRequestException);
  });
});

describe("FieldBoloService", () => {
  it("validates sighting payload", () => {
    expect(() => validateOperationalSightingDto({ sightingType: "Other", title: "" } as never)).toThrow(BadRequestException);
  });
});

describe("FieldOperationalResponsesService", () => {
  it("validates response type", () => {
    expect(() => validateOperationalResponseDto({ responseType: "Invalid" as never })).toThrow(BadRequestException);
  });
});

describe("assertFieldSession", () => {
  it("rejects non-field tokens", () => {
    expect(() => assertFieldSession({ sub: "a", typ: "admin", permissions: [] })).toThrow(ForbiddenException);
  });
});
