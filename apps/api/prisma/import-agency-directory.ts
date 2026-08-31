import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadAgencySeed, validateAgencySeed } from "../src/modules/agencies/agency-reference";

const prisma = new PrismaClient();
const path = resolve(
  process.argv.find((argument) => argument.endsWith(".json"))
    ?? "prisma/data/nigeria-federal-agencies.official-2026-08-31.json",
);

async function main() {
  const document = await loadAgencySeed(path);
  const sourceErrors = validateAgencySeed(document);
  if (sourceErrors.length > 0) throw new Error(sourceErrors.join("\n"));
  if (process.argv.includes("--dry-run")) {
    console.log(`Validated ${document.agencies.length} verified agency seeds`);
    return;
  }
  const verifiedAt = new Date(document.retrievedAt);
  const country = await prisma.country.findUnique({ where: { code: document.countryCode } });
  if (!country) throw new Error("Import Nigeria geography before importing the agency directory");

  for (const entry of document.agencies) {
    const governmentLevel = entry.governmentLevel ?? "FEDERAL";
    const state = entry.stateName
      ? await prisma.administrativeState.findFirst({
          where: { countryId: country.id, name: entry.stateName, isActive: true },
        })
      : null;
    if (governmentLevel === "STATE" && !state) {
      throw new Error(`${entry.code}: canonical State/FCT not found for ${entry.stateName}`);
    }
    const jurisdictionLevel = governmentLevel === "STATE" ? "STATE" : "COUNTRY";
    const coverageType = governmentLevel === "STATE" ? "STATE" : "NATIONAL";

    const agency = await prisma.agency.upsert({
      where: { code: entry.code },
      create: {
        code: entry.code,
        name: entry.officialName,
        officialName: entry.officialName,
        shortName: entry.shortName,
        aliases: entry.aliases,
        description: entry.description,
        type: entry.type,
        governmentLevel,
        jurisdictionLevel,
        countryCode: document.countryCode,
        stateCode: state?.name,
        officialWebsite: entry.website,
        verificationStatus: "VERIFIED",
        verifiedAt,
        verificationSource: entry.sourceUrl,
        isGovernment: true,
        isEmergencyResponder: true,
        isActive: true,
        status: "Active",
      },
      update: {
        name: entry.officialName,
        officialName: entry.officialName,
        shortName: entry.shortName,
        aliases: entry.aliases,
        description: entry.description,
        type: entry.type,
        governmentLevel,
        jurisdictionLevel,
        countryCode: document.countryCode,
        stateCode: state?.name,
        officialWebsite: entry.website,
        verificationStatus: "VERIFIED",
        verifiedAt,
        verificationSource: entry.sourceUrl,
        isGovernment: true,
        isEmergencyResponder: true,
        isActive: true,
        status: "Active",
      },
    });

    const existingOffice = await prisma.agencyOffice.findFirst({
      where: { agencyId: agency.id, name: entry.office.name, countryId: country.id },
    });
    const office = existingOffice
      ? await prisma.agencyOffice.update({
          where: { id: existingOffice.id },
          data: {
            officeType: entry.office.type as never,
            physicalAddress: entry.office.address,
            stateId: state?.id ?? null,
            is24Hours: entry.office.is24Hours ?? null,
            verificationStatus: "VERIFIED",
            verifiedAt,
            sourceUrl: entry.sourceUrl,
            isActive: true,
          },
        })
      : await prisma.agencyOffice.create({
          data: {
            agencyId: agency.id,
            countryId: country.id,
            stateId: state?.id,
            name: entry.office.name,
            officeType: entry.office.type as never,
            physicalAddress: entry.office.address,
            is24Hours: entry.office.is24Hours ?? null,
            verificationStatus: "VERIFIED",
            verifiedAt,
            sourceUrl: entry.sourceUrl,
          },
        });

    const jurisdiction = await prisma.agencyJurisdiction.findFirst({
      where: {
        agencyId: agency.id,
        officeId: null,
        coverageType,
        countryId: country.id,
        stateId: state?.id ?? null,
      },
    });
    if (jurisdiction) {
      await prisma.agencyJurisdiction.update({
        where: { id: jurisdiction.id },
        data: { isPrimary: true, isActive: true },
      });
    } else {
      await prisma.agencyJurisdiction.create({
        data: {
          agencyId: agency.id,
          countryId: country.id,
          stateId: state?.id,
          coverageType,
          isPrimary: true,
        },
      });
    }

    for (const contact of entry.contacts) {
      const existing = await prisma.agencyContact.findFirst({
        where: { agencyId: agency.id, officeId: office.id, type: contact.type as never, value: contact.value },
      });
      const data = {
        label: contact.label,
        emergencyOnly: contact.emergencyOnly ?? false,
        publiclyVerified: true,
        verificationStatus: "VERIFIED" as const,
        sourceUrl: contact.sourceUrl,
        lastVerifiedAt: verifiedAt,
        isActive: true,
      };
      if (existing) {
        await prisma.agencyContact.update({ where: { id: existing.id }, data });
      } else {
        await prisma.agencyContact.create({
          data: {
            agencyId: agency.id,
            officeId: office.id,
            type: contact.type as never,
            value: contact.value,
            ...data,
          },
        });
      }
    }

    for (const incidentType of entry.incidentTypes) {
      await prisma.agencyIncidentCapability.upsert({
        where: { agencyId_incidentType: { agencyId: agency.id, incidentType: incidentType as never } },
        create: {
          agencyId: agency.id,
          incidentType: incidentType as never,
          priority: 100,
          canReceiveReport: true,
          canDispatch: agency.isDispatchable,
          canEscalate: true,
        },
        update: {
          priority: 100,
          canReceiveReport: true,
          canDispatch: agency.isDispatchable,
          canEscalate: true,
          isActive: true,
        },
      });
    }
  }

  console.log(`Imported ${document.agencies.length} verified agencies`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
