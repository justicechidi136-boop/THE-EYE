import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  loadAgencySeed,
  normalizeFederalFormations,
  validateAgencySeed,
} from "../src/modules/agencies/agency-reference";

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
    console.log(`Agency seeds: ${document.agencies.length}`);
    console.log(`Federal formation seeds: ${normalizeFederalFormations(document).length}`);
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
      if (office.addressVerified && (!office.physicalAddress || !office.addressSourceUrl || !office.addressVerifiedAt)) {
        errors.push(`${agency.code}/${office.name}: verified address lacks value/provenance/date`);
      }
      const hasCoordinatePair = office.latitude != null && office.longitude != null;
      const coordinateClassQualified = ["AUTHORITATIVE_COORDINATE", "VERIFIED_ADDRESS_GEOCODE"].includes(
        office.coordinateEvidenceClass,
      );
      if (office.coordinatesVerified && (
        !hasCoordinatePair || !coordinateClassQualified || !office.coordinatesSourceUrl || !office.coordinatesVerifiedAt
      )) {
        errors.push(`${agency.code}/${office.name}: verified coordinates lack qualified evidence/provenance/date`);
      }
      if (office.coordinateEvidenceClass === "THIRD_PARTY_REFERENCE" && office.coordinatesVerified) {
        errors.push(`${agency.code}/${office.name}: third-party coordinates marked verified`);
      }
      if (office.operatingHoursVerified && (
        office.is24Hours == null || !office.operatingHoursSourceUrl || !office.operatingHoursVerifiedAt
      )) {
        errors.push(`${agency.code}/${office.name}: verified operating hours lack value/provenance/date`);
      }
    }
  }
  for (const formation of normalizeFederalFormations(document)) {
    const agency = agencies.find((candidate) => candidate.code === formation.parentAgencyCode);
    const office = agency?.offices.find((candidate) => candidate.name === formation.name);
    if (!agency || agency.governmentLevel !== "FEDERAL") {
      errors.push(`${formation.name}: federal parent agency missing`);
      continue;
    }
    if (!office) {
      errors.push(`${formation.name}: formation office missing`);
      continue;
    }
    if (formation.officeStateName) {
      const state = await prisma.administrativeState.findUnique({ where: { id: office.stateId ?? "" } });
      if (state?.name !== formation.officeStateName) errors.push(`${formation.name}: canonical office State mismatch`);
    }
    for (const stateName of formation.jurisdictionStateNames) {
      const state = await prisma.administrativeState.findFirst({ where: { countryId: office.countryId, name: stateName } });
      if (!state || !agency.directoryJurisdictions.some((row) => (
        row.officeId === office.id && row.stateId === state.id && row.coverageType === "STATE"
      ))) {
        errors.push(`${formation.name}: ${stateName} formation jurisdiction missing`);
      }
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));

  const verified = agencies.filter((agency) => agency.verificationStatus === "VERIFIED").length;
  const partial = agencies.filter((agency) => agency.verificationStatus === "PARTIALLY_VERIFIED").length;
  console.log("Agency directory validation: PASS");
  console.log(`Verified agencies: ${verified}`);
  console.log(`Partially verified agencies: ${partial}`);
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
