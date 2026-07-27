import { inspectGeneratedPrismaClient, verifyPrismaSchemaCompatibility } from "../prisma-schema-compat";

describe("prisma schema compatibility", () => {
  it("generated client includes IncidentLocationUpdate delegate operations", () => {
    const generated = inspectGeneratedPrismaClient();
    expect(generated.hasIncidentLocationUpdateModel).toBe(true);
    expect(generated.hasDelegate).toBe(true);
    expect(generated.hasCreate).toBe(true);
  });

  it("reports ok when model exists and count succeeds", async () => {
    const prisma = {
      incidentLocationUpdate: { count: async () => 2 },
      $queryRaw: async () => [],
    };
    const result = await verifyPrismaSchemaCompatibility(prisma as never);
    expect(result.schemaCompatibility).toBe("ok");
    expect(result.incidentLocationModel).toBe("ok");
    expect(result.prismaClient).toBe("ok");
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
