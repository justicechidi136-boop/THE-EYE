import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  loadGeographySnapshot,
  slugifyLocation,
  validateGeographySnapshot,
} from "../src/modules/locations/geography-reference";

const prisma = new PrismaClient();
const snapshotPath = resolve(
  process.argv.find((argument) => argument.endsWith(".json"))
    ?? "prisma/data/nigeria-geography.inec-2026-08-31.json",
);
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const snapshot = await loadGeographySnapshot(snapshotPath);
  const validation = validateGeographySnapshot(snapshot);
  if (validation.errors.length > 0) {
    throw new Error(`Geography snapshot validation failed:\n${validation.errors.join("\n")}`);
  }
  if (dryRun) {
    console.log(`Validated ${validation.counts.states} State/FCT, ${validation.counts.lgas} LGA/Area Councils, ${validation.counts.wards} wards`);
    return;
  }

  const checksum = createHash("sha256").update(await readFile(snapshotPath)).digest("hex");
  const source = await prisma.referenceDataSource.upsert({
    where: { url: snapshot.provenance.sourceUrl },
    create: {
      organization: snapshot.provenance.organization,
      title: snapshot.provenance.sourceDescription,
      url: snapshot.provenance.sourceUrl,
      version: `retrieved-${snapshot.provenance.retrievedAt.slice(0, 10)}`,
      retrievedAt: new Date(snapshot.provenance.retrievedAt),
      checksum,
      metadata: {
        apiBaseUrl: snapshot.provenance.apiBaseUrl,
        transformations: snapshot.provenance.transformations,
        anomalies: snapshot.provenance.anomalies,
        rawCounts: snapshot.rawCounts,
        canonicalCounts: snapshot.counts,
      },
    },
    update: {
      title: snapshot.provenance.sourceDescription,
      version: `retrieved-${snapshot.provenance.retrievedAt.slice(0, 10)}`,
      retrievedAt: new Date(snapshot.provenance.retrievedAt),
      checksum,
      metadata: {
        apiBaseUrl: snapshot.provenance.apiBaseUrl,
        transformations: snapshot.provenance.transformations,
        anomalies: snapshot.provenance.anomalies,
        rawCounts: snapshot.rawCounts,
        canonicalCounts: snapshot.counts,
      },
    },
  });

  const country = await prisma.country.upsert({
    where: { code: snapshot.country.code },
    create: {
      sourceId: source.id,
      code: snapshot.country.code,
      name: snapshot.country.name,
      officialName: snapshot.country.officialName,
      slug: slugifyLocation(snapshot.country.name),
      aliases: ["NG", "Federal Republic of Nigeria"],
    },
    update: {
      sourceId: source.id,
      name: snapshot.country.name,
      officialName: snapshot.country.officialName,
      slug: slugifyLocation(snapshot.country.name),
      aliases: ["NG", "Federal Republic of Nigeria"],
      isActive: true,
    },
  });

  for (const stateData of snapshot.states) {
    const state = await prisma.administrativeState.upsert({
      where: { countryId_code: { countryId: country.id, code: stateData.code } },
      create: {
        countryId: country.id,
        sourceId: source.id,
        sourceRecordId: String(stateData.sourceId),
        code: stateData.code,
        name: stateData.name,
        officialName: stateData.officialName,
        type: stateData.type,
        slug: slugifyLocation(stateData.name),
        aliases: stateData.type === "FCT" ? ["FCT", "Abuja", "FCT Abuja"] : [],
      },
      update: {
        sourceId: source.id,
        sourceRecordId: String(stateData.sourceId),
        name: stateData.name,
        officialName: stateData.officialName,
        type: stateData.type,
        slug: slugifyLocation(stateData.name),
        aliases: stateData.type === "FCT" ? ["FCT", "Abuja", "FCT Abuja"] : [],
        isActive: true,
      },
    });

    for (const lgaData of stateData.lgas) {
      const lga = await prisma.localGovernmentArea.upsert({
        where: { stateId_code: { stateId: state.id, code: lgaData.code } },
        create: {
          stateId: state.id,
          sourceId: source.id,
          sourceRecordId: String(lgaData.sourceId),
          code: lgaData.code,
          name: lgaData.name,
          officialName: lgaData.officialName,
          type: lgaData.type,
          slug: slugifyLocation(lgaData.name),
        },
        update: {
          sourceId: source.id,
          sourceRecordId: String(lgaData.sourceId),
          name: lgaData.name,
          officialName: lgaData.officialName,
          type: lgaData.type,
          slug: slugifyLocation(lgaData.name),
          isActive: true,
        },
      });

      for (const wardData of lgaData.wards) {
        await prisma.ward.upsert({
          where: { lgaId_code: { lgaId: lga.id, code: wardData.code } },
          create: {
            lgaId: lga.id,
            sourceId: source.id,
            sourceRecordId: String(wardData.sourceId),
            code: wardData.code,
            name: wardData.name,
            officialName: wardData.officialName,
            slug: slugifyLocation(wardData.name),
          },
          update: {
            sourceId: source.id,
            sourceRecordId: String(wardData.sourceId),
            name: wardData.name,
            officialName: wardData.officialName,
            slug: slugifyLocation(wardData.name),
            isActive: true,
          },
        });
      }
    }
  }

  await prisma.$executeRawUnsafe(`
    UPDATE jurisdictions j
    SET country_ref_id = (
          SELECT c.id FROM countries c WHERE c.code = 'NG'
        ),
        state_ref_id = (
          SELECT s.id
          FROM administrative_states s
          JOIN countries c ON c.id = s.country_id
          WHERE c.code = 'NG' AND lower(s.name) = lower(j.state)
        ),
        lga_ref_id = (
          SELECT l.id
          FROM local_government_areas l
          JOIN administrative_states s ON s.id = l.state_id
          JOIN countries c ON c.id = s.country_id
          WHERE c.code = 'NG'
            AND lower(s.name) = lower(j.state)
            AND lower(l.name) = lower(j.lga)
        )
    WHERE lower(j.country) IN ('nigeria', 'ng')
      AND EXISTS (SELECT 1 FROM countries c WHERE c.code = 'NG')
  `);

  console.log(`Imported Nigeria geography from ${snapshot.provenance.organization}`);
  console.log(`State/FCT: ${validation.counts.states}`);
  console.log(`LGA/Area Councils: ${validation.counts.lgas}`);
  console.log(`Wards: ${validation.counts.wards}`);
  console.log(`Source checksum: ${checksum}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
