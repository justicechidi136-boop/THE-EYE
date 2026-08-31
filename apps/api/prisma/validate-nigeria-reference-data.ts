import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  loadGeographySnapshot,
  validateGeographySnapshot,
} from "../src/modules/locations/geography-reference";

const prisma = new PrismaClient();
const snapshotPath = resolve(
  process.argv.find((argument) => argument.endsWith(".json"))
    ?? "prisma/data/nigeria-geography.inec-2026-08-31.json",
);

async function main() {
  const snapshot = await loadGeographySnapshot(snapshotPath);
  const sourceValidation = validateGeographySnapshot(snapshot);
  const errors = [...sourceValidation.errors];
  if (errors.length > 0) throw new Error(errors.join("\n"));
  if (process.argv.includes("--source-only")) {
    console.log("Nigeria administrative geography source validation: PASS");
    console.log(`State/FCT: ${sourceValidation.counts.states}`);
    console.log(`LGA/Area Councils: ${sourceValidation.counts.lgas}`);
    console.log(`Wards: ${sourceValidation.counts.wards}`);
    return;
  }
  const country = await prisma.country.findUnique({ where: { code: "NG" } });
  if (!country) throw new Error("Nigeria (NG) is missing from countries");

  const [states, lgas, wards, orphanLgas, orphanWards] = await Promise.all([
    prisma.administrativeState.count({ where: { countryId: country.id, isActive: true } }),
    prisma.localGovernmentArea.count({ where: { state: { countryId: country.id }, isActive: true } }),
    prisma.ward.count({ where: { lga: { state: { countryId: country.id } }, isActive: true } }),
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM local_government_areas l LEFT JOIN administrative_states s ON s.id = l.state_id WHERE s.id IS NULL`,
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM wards w LEFT JOIN local_government_areas l ON l.id = w.lga_id WHERE l.id IS NULL`,
  ]);

  const actual = { states, lgas, wards };
  for (const key of ["states", "lgas", "wards"] as const) {
    if (actual[key] !== snapshot.expectedCounts[key]) {
      errors.push(`Database ${key}: expected ${snapshot.expectedCounts[key]}, received ${actual[key]}`);
    }
  }
  if (Number(orphanLgas[0]?.count ?? 0) > 0) errors.push("Orphan LGAs exist");
  if (Number(orphanWards[0]?.count ?? 0) > 0) errors.push("Orphan wards exist");
  if (errors.length > 0) throw new Error(errors.join("\n"));

  console.log("Nigeria administrative geography validation: PASS");
  console.log(`Nigeria: 1`);
  console.log(`State/FCT: ${states}`);
  console.log(`LGA/Area Councils: ${lgas}`);
  console.log(`Wards: ${wards}`);
  console.log("Orphan LGAs: 0");
  console.log("Orphan wards: 0");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
