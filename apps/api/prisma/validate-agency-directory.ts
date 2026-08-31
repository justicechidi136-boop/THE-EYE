import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadAgencySeed, validateAgencySeed } from "../src/modules/agencies/agency-reference";

const prisma = new PrismaClient();

async function main() {
  const path = resolve(
    process.argv.find((argument) => argument.endsWith(".json"))
      ?? "prisma/data/nigeria-federal-agencies.official-2026-08-31.json",
  );
  const document = await loadAgencySeed(path);
  const sourceErrors = validateAgencySeed(document);
  if (sourceErrors.length > 0) throw new Error(sourceErrors.join("\n"));
  if (process.argv.includes("--source-only")) {
    console.log("Agency directory source validation: PASS");
    console.log(`Verified federal agency seeds: ${document.agencies.length}`);
    return;
  }
  const agencies = await prisma.agency.findMany({
    where: { verificationStatus: { in: ["VERIFIED", "PARTIALLY_VERIFIED"] } },
    include: {
      offices: true,
      directoryContacts: true,
      directoryJurisdictions: true,
      incidentCapabilities: true,
    },
  });
  const errors: string[] = [];
  for (const agency of agencies) {
    if (!agency.officialName?.trim()) errors.push(`${agency.code}: missing official name`);
    if (!agency.verificationSource || !agency.verifiedAt) {
      errors.push(`${agency.code}: verified without source/date`);
    }
    if (agency.directoryJurisdictions.length === 0) errors.push(`${agency.code}: no jurisdiction`);
    for (const contact of agency.directoryContacts) {
      if (contact.publiclyVerified && (!contact.sourceUrl || !contact.lastVerifiedAt)) {
        errors.push(`${agency.code}: public contact lacks provenance`);
      }
    }
    for (const office of agency.offices) {
      if (office.wardId && !office.lgaId) errors.push(`${agency.code}/${office.name}: Ward without LGA`);
      if (office.lgaId && !office.stateId) errors.push(`${agency.code}/${office.name}: LGA without State`);
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));

  const verified = agencies.filter((agency) => agency.verificationStatus === "VERIFIED").length;
  console.log("Agency directory validation: PASS");
  console.log(`Verified agencies: ${verified}`);
  console.log(`Offices/commands: ${agencies.reduce((sum, agency) => sum + agency.offices.length, 0)}`);
  console.log(`Public contacts: ${agencies.reduce((sum, agency) => sum + agency.directoryContacts.filter((contact) => contact.publiclyVerified).length, 0)}`);
  console.log(`Jurisdictions: ${agencies.reduce((sum, agency) => sum + agency.directoryJurisdictions.length, 0)}`);
  console.log(`Incident mappings: ${agencies.reduce((sum, agency) => sum + agency.incidentCapabilities.length, 0)}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
