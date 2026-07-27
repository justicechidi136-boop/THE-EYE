import { Prisma, PrismaClient } from "@prisma/client";

export type PrismaSchemaCompatResult = {
  prismaClient: "ok" | "error";
  incidentLocationModel: "ok" | "error";
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

export async function verifyPrismaSchemaCompatibility(
  prisma: Pick<PrismaClient, "incidentLocationUpdate" | "$queryRaw">,
): Promise<PrismaSchemaCompatResult> {
  const generated = inspectGeneratedPrismaClient();

  if (!generated.hasIncidentLocationUpdateModel) {
    return {
      prismaClient: "ok",
      incidentLocationModel: "error",
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
        schemaCompatibility: "error",
        errorCode: "PRISMA-SCHEMA-002",
        clientVersion: generated.clientVersion,
        detail: "incident_location_updates table unavailable",
      };
    }
    return {
      prismaClient: "error",
      incidentLocationModel: "ok",
      schemaCompatibility: "error",
      errorCode: "PRISMA-SCHEMA-004",
      clientVersion: generated.clientVersion,
      detail: message,
    };
  }

  return {
    prismaClient: "ok",
    incidentLocationModel: "ok",
    schemaCompatibility: "ok",
    clientVersion: generated.clientVersion,
  };
}
