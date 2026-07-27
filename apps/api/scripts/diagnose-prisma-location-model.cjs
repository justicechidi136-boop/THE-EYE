#!/usr/bin/env node
/**
 * Safe diagnostic: reports whether generated Prisma client exposes IncidentLocationUpdate.
 * Does not connect to DB or print credentials.
 */
const { Prisma, PrismaClient } = require("@prisma/client");

const models = Prisma.dmmf.datamodel.models.map((m) => m.name);
const hasModel = models.includes("IncidentLocationUpdate");
const pkg = require("@prisma/client/package.json");
const clientVersion = pkg.version;

function probeClient(label, client) {
  const delegate = client.incidentLocationUpdate;
  return {
    label,
    hasDelegate: Boolean(delegate),
    hasCreate: typeof delegate?.create === "function",
    hasFindFirst: typeof delegate?.findFirst === "function",
    hasCount: typeof delegate?.count === "function",
  };
}

async function main() {
  const base = new PrismaClient();
  const extended = base.$extends({
    query: {
      async $allOperations({ args, query }) {
        return query(args);
      },
    },
  });

  const report = {
    clientVersion,
    hasIncidentLocationUpdateModel: hasModel,
    baseClient: probeClient("base", new PrismaClient()),
    extendedOnly: probeClient("extended", extended),
  };

  console.log(JSON.stringify(report, null, 2));

  const ok =
    report.hasIncidentLocationUpdateModel &&
    report.baseClient.hasDelegate &&
    report.baseClient.hasCreate &&
    report.baseClient.hasFindFirst &&
    report.baseClient.hasCount;

  if (!ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
