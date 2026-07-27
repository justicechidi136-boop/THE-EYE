#!/usr/bin/env node
/**
 * Runtime Prisma forensic audit — safe to run inside API/tools container.
 * Does not print credentials. Exits non-zero on createOne mismatch.
 */
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function findFiles(root, pattern, limit = 50) {
  const hits = [];
  if (!fs.existsSync(root)) return hits;
  const stack = [root];
  while (stack.length > 0 && hits.length < limit) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" && dir !== root && !full.includes(".pnpm")) continue;
        stack.push(full);
      } else if (pattern.test(entry.name)) {
        hits.push(full);
        if (hits.length >= limit) break;
      }
    }
  }
  return hits;
}

function resolveReal(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
}

function main() {
  const cwd = process.cwd();
  const clientEntry = require.resolve("@prisma/client");
  const clientReal = resolveReal(clientEntry);
  const clientPkg = safeReadJson(path.join(path.dirname(clientEntry), "package.json"));
  const prismaPkg = safeReadJson(path.join(path.dirname(clientEntry), "..", ".prisma", "client", "package.json"));

  let engineVersion = null;
  try {
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    engineVersion = prisma._engineConfig?.activeProvider ?? prisma._clientVersion ?? null;
    prisma.$disconnect().catch(() => undefined);
  } catch {
    engineVersion = null;
  }

  const { Prisma } = require("@prisma/client");
  const models = Prisma.dmmf.datamodel.models.map((m) => m.name);
  const incidentModel = Prisma.dmmf.datamodel.models.find((m) => m.name === "IncidentLocationUpdate");

  const schemaPath = path.resolve(cwd, "prisma/schema.prisma");
  const schemaExists = fs.existsSync(schemaPath);
  const schemaStat = schemaExists ? fs.statSync(schemaPath) : null;

  const clientDirs = [];
  for (const root of [cwd, path.join(cwd, "node_modules"), path.join(cwd, "node_modules/.pnpm")]) {
    clientDirs.push(...findFiles(root, /^libquery_engine.*\.node$|^query_engine.*\.node$/, 20));
  }

  const indexJsPaths = findFiles(path.join(cwd, "node_modules"), /^index\.js$/, 30).filter((p) =>
    p.includes("@prisma/client"),
  );

  const report = {
    cwd,
    schema: {
      path: schemaPath,
      exists: schemaExists,
      sizeBytes: schemaStat?.size ?? null,
      mtime: schemaStat?.mtime?.toISOString?.() ?? null,
      hasIncidentLocationUpdate: schemaExists
        ? fs.readFileSync(schemaPath, "utf8").includes("model IncidentLocationUpdate")
        : false,
    },
    import: {
      clientEntry,
      clientReal,
      clientVersion: clientPkg?.version ?? null,
      engineVersion,
    },
    dmmf: {
      modelCount: models.length,
      hasIncidentLocationUpdate: models.includes("IncidentLocationUpdate"),
      incidentLocationUpdateFields: incidentModel?.fields?.map((f) => ({
        name: f.name,
        kind: f.kind,
        type: f.type,
      })),
    },
    engines: clientDirs.map((p) => ({ path: p, real: resolveReal(p) })),
    prismaClientIndexFiles: indexJsPaths.slice(0, 10),
  };

  console.log(JSON.stringify(report, null, 2));
}

async function probeCreate() {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  try {
    await prisma.incidentLocationUpdate.create({
      data: {
        incidentId: "00000000-0000-4000-8000-000000000001",
        latitude: 1,
        longitude: 1,
        capturedAt: new Date(),
        sequenceNumber: -9999999,
        metadata: { forensicProbe: true },
      },
    });
    console.error(JSON.stringify({ probe: "unexpected_success_without_db" }));
    process.exit(1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = typeof error?.code === "string" ? error.code : "";
    if (/does not match any query/i.test(message) || /createOne.*IncidentLocationUpdate/i.test(message)) {
      console.error(JSON.stringify({ probe: "createOne_mismatch", message: message.slice(0, 400) }));
      process.exit(1);
    }
    if (code === "P2003" || code === "P2021" || /Foreign key constraint/i.test(message) || /connect/i.test(message)) {
      console.log(JSON.stringify({ probe: "create_accepted", detail: message.slice(0, 200) }));
      return;
    }
    console.error(JSON.stringify({ probe: "create_failed", message: message.slice(0, 400) }));
    process.exit(1);
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main();
probeCreate().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
