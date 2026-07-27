import { IncidentStatus } from "@the-eye/shared";
import { Prisma, PrismaClient } from "@prisma/client";

export type PrismaSchemaCompatResult = {
  prismaClient: "ok" | "error";
  incidentLocationModel: "ok" | "error";
  incidentLocationCreateCapability: "ok" | "degraded" | "error";
  schemaCompatibility: "ok" | "error";
  errorCode?: "PRISMA-SCHEMA-001" | "PRISMA-SCHEMA-002" | "PRISMA-SCHEMA-003" | "PRISMA-SCHEMA-004";
  clientVersion?: string;
  detail?: string;
};

export function inspectGeneratedPrismaClient(): {
  hasIncidentLocationUpdateModel: boolean;
  hasDelegate: boolean;
  hasCreate: boolean;
  hasFindFirst: boolean;
  hasCount: boolean;
  clientVersion: string;
} {
  const models = Prisma.dmmf.datamodel.models.map((model) => model.name);
  const clientVersion = require("@prisma/client/package.json").version as string;
  const probe = new PrismaClient();
  const delegate = (probe as any).incidentLocationUpdate;
  return {
    hasIncidentLocationUpdateModel: models.includes("IncidentLocationUpdate"),
    hasDelegate: Boolean(delegate),
    hasCreate: typeof delegate?.create === "function",
    hasFindFirst: typeof delegate?.findFirst === "function",
    hasCount: typeof delegate?.count === "function",
    clientVersion,
  };
}

export class PrismaSchemaProbeRollback extends Error {
  constructor() {
    super("PRISMA_SCHEMA_PROBE_ROLLBACK");
    this.name = "PrismaSchemaProbeRollback";
  }
}

export async function verifyIncidentLocationCreateOperation(
  prisma: Pick<PrismaClient, "incidentLocationUpdate" | "incident" | "$transaction">,
): Promise<{ createOperation: "ok" | "degraded" | "error"; detail?: string }> {
  const probeIncident = await (prisma as any).incident?.findFirst?.({
    where: { status: { in: [IncidentStatus.Closed, IncidentStatus.FalseReport, IncidentStatus.Resolved] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!probeIncident?.id) {
    return { createOperation: "degraded", detail: "skipped_no_closed_incident_for_create_probe" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await (tx as any).incidentLocationUpdate.create({
        data: {
          incidentId: probeIncident.id,
          latitude: 1,
          longitude: 1,
          capturedAt: new Date(),
          sequenceNumber: -9_999_999,
          metadata: { probe: true, rolledBack: true },
        },
      });
      throw new PrismaSchemaProbeRollback();
    });
    return { createOperation: "ok" };
  } catch (error) {
    if (error instanceof PrismaSchemaProbeRollback) {
      return { createOperation: "ok" };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { createOperation: "error", detail: message };
  }
}

export async function verifyPrismaSchemaCompatibility(
  prisma: Pick<PrismaClient, "incidentLocationUpdate" | "incident" | "$queryRaw" | "$transaction">,
): Promise<PrismaSchemaCompatResult> {
  const generated = inspectGeneratedPrismaClient();

  if (!generated.hasIncidentLocationUpdateModel) {
    return {
      prismaClient: "ok",
      incidentLocationModel: "error",
      incidentLocationCreateCapability: "error",
      schemaCompatibility: "error",
      errorCode: "PRISMA-SCHEMA-001",
      clientVersion: generated.clientVersion,
      detail: "IncidentLocationUpdate missing from generated Prisma DMMF",
    };
  }

  if (!generated.hasDelegate || !generated.hasCreate || !generated.hasFindFirst || !generated.hasCount) {
    return {
      prismaClient: "ok",
      incidentLocationModel: "error",
      incidentLocationCreateCapability: "error",
      schemaCompatibility: "error",
      errorCode: "PRISMA-SCHEMA-004",
      clientVersion: generated.clientVersion,
      detail: "IncidentLocationUpdate delegate or required operations missing from generated client",
    };
  }

  try {
    await prisma.incidentLocationUpdate.count();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const prismaCode = typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : null;
    if (prismaCode === "P2021" || /incident_location_updates/i.test(message)) {
      return {
        prismaClient: "ok",
        incidentLocationModel: "error",
        incidentLocationCreateCapability: "error",
        schemaCompatibility: "error",
        errorCode: "PRISMA-SCHEMA-002",
        clientVersion: generated.clientVersion,
        detail: "incident_location_updates table unavailable",
      };
    }
    return {
      prismaClient: "error",
      incidentLocationModel: "ok",
      incidentLocationCreateCapability: "error",
      schemaCompatibility: "error",
      errorCode: "PRISMA-SCHEMA-004",
      clientVersion: generated.clientVersion,
      detail: message,
    };
  }

  const createProbe = await verifyIncidentLocationCreateOperation(prisma);
  if (createProbe.createOperation === "error") {
    const detail = createProbe.detail ?? "IncidentLocationUpdate create probe failed";
    const isCreateOneMismatch =
      /createOne.*IncidentLocationUpdate/i.test(detail) || /does not match any query/i.test(detail);
    return {
      prismaClient: "ok",
      incidentLocationModel: "ok",
      incidentLocationCreateCapability: "error",
      schemaCompatibility: "error",
      errorCode: isCreateOneMismatch ? "PRISMA-SCHEMA-003" : "PRISMA-SCHEMA-004",
      clientVersion: generated.clientVersion,
      detail,
    };
  }

  const createCapability = createProbe.createOperation;
  if (createCapability === "degraded") {
    return {
      prismaClient: "ok",
      incidentLocationModel: "ok",
      incidentLocationCreateCapability: "degraded",
      schemaCompatibility: "ok",
      clientVersion: generated.clientVersion,
      detail: createProbe.detail,
    };
  }

  return {
    prismaClient: "ok",
    incidentLocationModel: "ok",
    incidentLocationCreateCapability: "ok",
    schemaCompatibility: "ok",
    clientVersion: generated.clientVersion,
  };
}
