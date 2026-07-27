import {
  inspectGeneratedPrismaClient,
  PrismaSchemaProbeRollback,
  verifyIncidentLocationCreateOperation,
  verifyPrismaSchemaCompatibility,
} from "../prisma-schema-compat";

describe("prisma schema compatibility", () => {
  it("generated client includes IncidentLocationUpdate delegate operations", () => {
    const generated = inspectGeneratedPrismaClient();
    expect(generated.hasIncidentLocationUpdateModel).toBe(true);
    expect(generated.hasDelegate).toBe(true);
    expect(generated.hasCreate).toBe(true);
  });

  it("reports ok when model exists and count succeeds", async () => {
    const prisma = {
      incidentLocationUpdate: { count: async () => 2, create: async () => ({ id: "loc-1" }) },
      incident: { findFirst: async () => ({ id: "inc-closed" }) },
      $queryRaw: async () => [],
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          incidentLocationUpdate: {
            create: async () => {
              throw new PrismaSchemaProbeRollback();
            },
          },
        }),
    };
    const result = await verifyPrismaSchemaCompatibility(prisma as never);
    expect(result.schemaCompatibility).toBe("ok");
    expect(result.incidentLocationCreateCapability).toBe("ok");
    expect(result.incidentLocationModel).toBe("ok");
    expect(result.prismaClient).toBe("ok");
  });

  it("reports PRISMA-SCHEMA-003 when createOne mismatch is detected", async () => {
    const prisma = {
      incidentLocationUpdate: { count: async () => 0 },
      incident: { findFirst: async () => ({ id: "inc-closed" }) },
      $queryRaw: async () => [],
      $transaction: async () => {
        throw new Error(
          "Operation 'createOne' for model 'IncidentLocationUpdate' does not match any query.",
        );
      },
    };
    const result = await verifyPrismaSchemaCompatibility(prisma as never);
    expect(result.errorCode).toBe("PRISMA-SCHEMA-003");
    expect(result.incidentLocationCreateCapability).toBe("error");
    expect(result.schemaCompatibility).toBe("error");
  });

  it("skips create probe when no closed incidents exist", async () => {
    const result = await verifyIncidentLocationCreateOperation({
      incident: { findFirst: async () => null },
      $transaction: async () => {
        throw new Error("should not run");
      },
    } as never);
    expect(result.createOperation).toBe("degraded");
    expect(result.detail).toContain("skipped");
  });

  it("reports PRISMA-SCHEMA-002 when table is missing", async () => {
    const prisma = {
      incidentLocationUpdate: {
        count: async () => {
          throw Object.assign(new Error("The table `public.incident_location_updates` does not exist."), {
            code: "P2021",
          });
        },
      },
      $queryRaw: async () => [],
    };
    const result = await verifyPrismaSchemaCompatibility(prisma as never);
    expect(result.errorCode).toBe("PRISMA-SCHEMA-002");
    expect(result.schemaCompatibility).toBe("error");
  });
});
