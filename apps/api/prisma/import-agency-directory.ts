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
    console.log(`Validated ${document.agencies.length} agency seeds and ${document.federalFormations?.length ?? 0} federal formation seeds`);
    return;
  }
  const verifiedAt = new Date(document.retrievedAt);
  const country = await prisma.country.findUnique({ where: { code: document.countryCode } });
  if (!country) throw new Error("Import Nigeria geography before importing the agency directory");

  for (const entry of document.agencies) {
    const governmentLevel = entry.governmentLevel ?? "FEDERAL";
    const requestedVerificationStatus = entry.verificationStatus ?? "VERIFIED";
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

    const currentAgency = await prisma.agency.findUnique({ where: { code: entry.code } });
    const verificationStatus = currentAgency?.verificationStatus === "VERIFIED"
      ? "VERIFIED"
      : requestedVerificationStatus;
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
        verificationStatus,
        verifiedAt,
        verificationSource: entry.sourceUrl,
        isGovernment: true,
        isEmergencyResponder: true,
        isDispatchable: false,
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
        officialWebsite: entry.website ?? null,
        verificationStatus,
        verifiedAt,
        verificationSource: entry.sourceUrl,
        isGovernment: true,
        isEmergencyResponder: true,
        isDispatchable: false,
        isActive: true,
        status: "Active",
      },
    });

    let office = null;
    if (entry.office) {
      const existingOffice = await prisma.agencyOffice.findFirst({
        where: { agencyId: agency.id, name: entry.office.name, countryId: country.id },
      });
      const officeVerificationStatus = existingOffice?.verificationStatus === "VERIFIED"
        ? "VERIFIED"
        : verificationStatus;
      office = existingOffice
        ? await prisma.agencyOffice.update({
            where: { id: existingOffice.id },
            data: {
              officeType: entry.office.type as never,
              physicalAddress: entry.office.address ?? null,
              stateId: state?.id ?? null,
              is24Hours: entry.office.is24Hours ?? null,
              verificationStatus: officeVerificationStatus,
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
              verificationStatus,
              verifiedAt,
              sourceUrl: entry.sourceUrl,
            },
          });
    }

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
        where: { agencyId: agency.id, officeId: office?.id ?? null, type: contact.type as never, value: contact.value },
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
            officeId: office?.id,
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
          canDispatch: false,
          canEscalate: false,
        },
        update: {
          priority: 100,
          canReceiveReport: true,
          canDispatch: false,
          canEscalate: false,
          isActive: true,
        },
      });
    }
  }

  for (const entry of document.federalFormations ?? []) {
    const agency = await prisma.agency.findUnique({ where: { code: entry.parentAgencyCode } });
    if (!agency || agency.governmentLevel !== "FEDERAL") {
      throw new Error(`${entry.parentAgencyCode}: verified federal parent agency not found`);
    }
    const state = await prisma.administrativeState.findFirst({
      where: { countryId: country.id, name: entry.stateName, isActive: true },
    });
    if (!state) throw new Error(`${entry.name}: canonical State/FCT not found for ${entry.stateName}`);
    const requestedStatus = entry.verificationStatus ?? "VERIFIED";
    const existingOffice = await prisma.agencyOffice.findFirst({
      where: { agencyId: agency.id, name: entry.name, countryId: country.id },
    });
    const verificationStatus = existingOffice?.verificationStatus === "VERIFIED"
      ? "VERIFIED"
      : requestedStatus;
    const office = existingOffice
      ? await prisma.agencyOffice.update({
          where: { id: existingOffice.id },
          data: {
            officeType: entry.type as never,
            physicalAddress: entry.address ?? null,
            stateId: state.id,
            verificationStatus,
            verifiedAt,
            sourceUrl: entry.sourceUrl,
            isActive: true,
          },
        })
      : await prisma.agencyOffice.create({
          data: {
            agencyId: agency.id,
            countryId: country.id,
            stateId: state.id,
            name: entry.name,
            officeType: entry.type as never,
            physicalAddress: entry.address,
            verificationStatus,
            verifiedAt,
            sourceUrl: entry.sourceUrl,
          },
        });

    const jurisdiction = await prisma.agencyJurisdiction.findFirst({
      where: {
        agencyId: agency.id,
        officeId: office.id,
        coverageType: "STATE",
        countryId: country.id,
        stateId: state.id,
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
          officeId: office.id,
          countryId: country.id,
          stateId: state.id,
          coverageType: "STATE",
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
  }

  console.log(`Imported ${document.agencies.length} agencies and ${document.federalFormations?.length ?? 0} federal formations`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
