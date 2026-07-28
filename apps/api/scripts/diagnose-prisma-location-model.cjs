#!/usr/bin/env node
/**
 * Safe diagnostic: reports whether generated Prisma client exposes IncidentLocationUpdate.
 * Does not connect to DB or print credentials.
 */
const { Prisma, PrismaClient } = require("@prisma/client");

const models = Prisma.dmmf.datamodel.models.map((m) => m.name);
const hasModel = models.includes("IncidentLocationUpdate");
const hasLiveVideoLocationModel = models.includes("LiveVideoLocationUpdate");
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

  function probeLiveVideoClient(label, client) {
    const delegate = client.liveVideoLocationUpdate;
    return {
      label,
      hasDelegate: Boolean(delegate),
      hasCreate: typeof delegate?.create === "function",
    };
  }

  const report = {
    clientVersion,
    hasIncidentLocationUpdateModel: hasModel,
    hasLiveVideoLocationUpdateModel: hasLiveVideoLocationModel,
    baseClient: probeClient("base", new PrismaClient()),
    extendedOnly: probeClient("extended", extended),
    liveVideoLocationClient: probeLiveVideoClient("base", new PrismaClient()),
  };

  console.log(JSON.stringify(report, null, 2));

  const ok =
    report.hasIncidentLocationUpdateModel &&
    report.baseClient.hasDelegate &&
    report.baseClient.hasCreate &&
    report.baseClient.hasFindFirst &&
    report.baseClient.hasCount;

  if (!ok || !hasLiveVideoLocationModel || !report.liveVideoLocationClient.hasCreate) {
    process.exit(1);
  }

  async function assertCreateOneWorks(label, attempt) {
    try {
      await attempt();
      console.error(JSON.stringify({ buildProbe: `${label}_unexpected_success` }));
      process.exit(1);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = typeof error?.code === "string" ? error.code : "";
      if (/does not match any query/i.test(message) || /createOne/i.test(message)) {
        console.error(JSON.stringify({ buildProbe: `${label}_createOne_mismatch`, message: message.slice(0, 240) }));
        process.exit(1);
      }
      if (code === "P2003" || code === "P2021" || /Foreign key constraint/i.test(message) || /connect/i.test(message)) {
        return;
      }
    }
  }

  // Runtime createOne must match generated DMMF (delegate-only checks miss stale query engines).
  const probe = new PrismaClient();
  try {
    await probe.incidentLocationUpdate.create({
      data: {
        incidentId: "00000000-0000-4000-8000-000000000001",
        latitude: 1,
        longitude: 1,
        capturedAt: new Date(),
        sequenceNumber: -9999999,
        metadata: { buildProbe: true },
      },
    });
    process.exit(1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = typeof error?.code === "string" ? error.code : "";
    if (/does not match any query/i.test(message) || /createOne.*IncidentLocationUpdate/i.test(message)) {
      console.error(JSON.stringify({ buildProbe: "incidentLocation_createOne_mismatch", message: message.slice(0, 240) }));
      process.exit(1);
    }
    if (code === "P2003" || code === "P2021" || /Foreign key constraint/i.test(message) || /connect/i.test(message)) {
      await assertCreateOneWorks("liveVideoLocation", () =>
        probe.liveVideoLocationUpdate.create({
          data: {
            liveVideoSessionId: "00000000-0000-4000-8000-000000000001",
            incidentId: "00000000-0000-4000-8000-000000000002",
            latitude: 1,
            longitude: 1,
            capturedAt: new Date(),
          },
        }),
      );
      return;
    }
    if (/incident_location_updates/i.test(message)) {
      console.error(JSON.stringify({ buildProbe: "table_error", message: message.slice(0, 240) }));
      process.exit(1);
    }
  } finally {
    await probe.$disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
