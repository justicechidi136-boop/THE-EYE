import { ConflictException, ForbiddenException } from "@nestjs/common";
import {
  FieldOfficerSafetyAlertType,
  FieldOperationalEventType,
  FIELD_SYNC_ERROR_CODES,
} from "@the-eye/shared";
import type { JwtPayload } from "../../../common/auth/jwt";
import { FieldEventsService } from "../field-events.service";
import { FieldMapService } from "../field-map.service";
import { FieldOfficerSafetyService } from "../field-officer-safety.service";
import { FieldSyncService } from "../field-sync.service";
import { IncidentCommunicationsAccessService } from "../../incident-communications/incident-communications-access.service";

describe("FieldMapService", () => {
  const actor: JwtPayload = {
    sub: "officer-1",
    typ: "field",
    fieldDeviceId: "device-1",
    agencyId: "agency-1",
    state: "Lagos",
    permissions: ["field:session:operate"],
  };

  it("requires agency scope for map context", async () => {
    const prisma = {} as never;
    const service = Object.create(FieldMapService.prototype) as FieldMapService;
    Object.assign(service, { prisma });
    await expect(
      service.getMapContext({ ...actor, agencyId: undefined }, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("FieldOfficerSafetyService", () => {
  const actor: JwtPayload = {
    sub: "officer-1",
    typ: "field",
    fieldDeviceId: "device-1",
    agencyId: "agency-1",
    permissions: ["field:session:operate"],
  };

  function createService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      fieldOfficerSafetyAlert: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: "alert-1",
          alertType: FieldOfficerSafetyAlertType.Panic,
          status: "Active",
          latitude: 6.5,
          longitude: 3.4,
          createdAt: new Date(),
        }),
      },
      fieldDevice: {
        findUnique: jest.fn().mockResolvedValue({ id: "device-1", isRevoked: false, isLost: false }),
      },
      officerStatus: { updateMany: jest.fn() },
      ...overrides,
    };
    const audit = { record: jest.fn() };
    const events = {
      publish: jest.fn().mockResolvedValue({ id: "evt-1", eventSequence: BigInt(1) }),
    };
    const service = Object.create(FieldOfficerSafetyService.prototype) as FieldOfficerSafetyService;
    Object.assign(service, { prisma, audit, events });
    return { service, prisma, events };
  }

  it("creates idempotent panic alert", async () => {
    const { service, prisma, events } = createService();
    const result = await service.triggerPanic(actor, {
      alertType: FieldOfficerSafetyAlertType.Panic,
      latitude: 6.5,
      longitude: 3.4,
      clientActionId: "client-1",
    });
    expect(result.data.id).toBe("alert-1");
    expect(prisma.fieldOfficerSafetyAlert.create).toHaveBeenCalled();
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: FieldOperationalEventType.OfficerSafety }),
    );
  });

  it("rejects panic on revoked device", async () => {
    const { service } = createService({
      fieldDevice: { findUnique: jest.fn().mockResolvedValue({ isRevoked: true, isLost: false }) },
    });
    await expect(
      service.triggerPanic(actor, { alertType: FieldOfficerSafetyAlertType.Panic }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("FieldEventsService", () => {
  it("polls events after sequence cursor", async () => {
    const actor: JwtPayload = {
      sub: "officer-1",
      typ: "field",
      fieldDeviceId: "device-1",
      agencyId: "agency-1",
      permissions: ["field:session:operate"],
    };
    const prisma = {
      fieldOperationalEvent: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "e1",
            eventSequence: BigInt(2),
            eventType: FieldOperationalEventType.BackupRequested,
            entityType: "field_backup_requests",
            entityId: "b1",
            generationId: "gen-1",
            payload: {},
            occurredAt: new Date(),
          },
        ]),
      },
      fieldDeviceSyncState: {
        findUnique: jest.fn().mockResolvedValue({ generationId: "gen-1" }),
      },
    };
    const service = Object.create(FieldEventsService.prototype) as FieldEventsService;
    Object.assign(service, { prisma });
    const result = await service.poll(actor, { afterSequence: "1" });
    expect(result.data.events).toHaveLength(1);
    expect(result.data.lastSequence).toBe("2");
  });
});

describe("FieldSyncService device revoked", () => {
  it("returns DEVICE_REVOKED conflict code", async () => {
    const actor: JwtPayload = {
      sub: "officer-1",
      typ: "field",
      fieldDeviceId: "device-1",
      agencyId: "agency-1",
      permissions: ["field:session:operate"],
    };
    const prisma = {
      fieldDevice: { findUnique: jest.fn().mockResolvedValue({ isRevoked: true, isLost: false }) },
      fieldDeviceSyncState: { upsert: jest.fn() },
    };
    const service = Object.create(FieldSyncService.prototype) as FieldSyncService;
    Object.assign(service, {
      prisma,
      shifts: {},
      patrols: {},
      patrolHardening: {},
      checkpoints: {},
      checkpointHardening: {},
      responses: {},
      bolo: {},
      backup: {},
      safety: {},
    });
    await expect(
      service.syncBatch(actor, { items: [] }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: FIELD_SYNC_ERROR_CODES.DEVICE_REVOKED }),
    });
  });
});

describe("IncidentCommunicationsAccessService field JWT", () => {
  it("grants responder access for assigned field officer", async () => {
    const prisma = {
      incident: {
        findUnique: jest.fn().mockResolvedValue({
          id: "inc-1",
          reporterId: null,
          status: "Active",
          assignedAgencyId: "agency-1",
          country: "NG",
          state: "Lagos",
          lga: "Ikeja",
          metadata: {},
        }),
      },
      incidentAssignment: {
        findFirst: jest.fn().mockResolvedValue({
          id: "asg-1",
          responder: { id: "resp-1", agencyId: "agency-1", displayName: "Officer A" },
        }),
      },
    };
    const service = Object.create(IncidentCommunicationsAccessService.prototype) as IncidentCommunicationsAccessService;
    Object.assign(service, { prisma });
    const access = await service.resolveAccess("inc-1", {
      sub: "officer-1",
      typ: "field",
      permissions: ["field:session:operate"],
    });
    expect(access.canRead).toBe(true);
    expect(access.canWrite).toBe(true);
    expect(access.canReadInternal).toBe(false);
    expect(access.role).toBe("Responder");
  });
});
