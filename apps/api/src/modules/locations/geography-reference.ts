import { readFile } from "node:fs/promises";

export type GeographyWard = {
  sourceId: number;
  code: string;
  name: string;
  officialName: string;
};

export type GeographyLga = {
  sourceId: number;
  code: string;
  name: string;
  officialName: string;
  type: "LGA" | "AREA_COUNCIL";
  wards: GeographyWard[];
};

export type GeographyState = {
  sourceId: number;
  code: string;
  name: string;
  officialName: string;
  type: "STATE" | "FCT";
  lgas: GeographyLga[];
};

export type NigeriaGeographySnapshot = {
  schemaVersion: number;
  country: { code: string; name: string; officialName: string };
  provenance: {
    organization: string;
    sourceUrl: string;
    apiBaseUrl: string;
    retrievedAt: string;
    sourceDescription: string;
    transformations: string[];
    anomalies: Array<Record<string, unknown>>;
  };
  rawCounts: { states: number; lgas: number; wards: number };
  expectedCounts: { states: number; lgas: number; wards: number };
  counts: { states: number; lgas: number; wards: number };
  states: GeographyState[];
};

export type GeographyValidationSummary = {
  counts: { states: number; lgas: number; wards: number };
  errors: string[];
};

export const slugifyLocation = (value: string) => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("en-NG")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

export async function loadGeographySnapshot(path: string): Promise<NigeriaGeographySnapshot> {
  return JSON.parse(await readFile(path, "utf8")) as NigeriaGeographySnapshot;
}

export function validateGeographySnapshot(
  snapshot: NigeriaGeographySnapshot,
): GeographyValidationSummary {
  const errors: string[] = [];
  const stateCodes = new Set<string>();
  const stateNames = new Set<string>();
  let lgaCount = 0;
  let wardCount = 0;

  if (snapshot.country.code !== "NG" || snapshot.country.name !== "Nigeria") {
    errors.push("The snapshot country must be Nigeria (NG)");
  }

  for (const state of snapshot.states) {
    if (stateCodes.has(state.code)) errors.push(`Duplicate State/FCT code: ${state.code}`);
    if (stateNames.has(state.name.toLocaleLowerCase("en-NG"))) {
      errors.push(`Duplicate State/FCT name: ${state.name}`);
    }
    stateCodes.add(state.code);
    stateNames.add(state.name.toLocaleLowerCase("en-NG"));
    const lgaCodes = new Set<string>();
    const lgaNames = new Set<string>();

    for (const lga of state.lgas) {
      lgaCount += 1;
      const lgaName = lga.name.toLocaleLowerCase("en-NG");
      if (lgaCodes.has(lga.code)) errors.push(`Duplicate LGA code ${state.name}/${lga.code}`);
      if (lgaNames.has(lgaName)) errors.push(`Duplicate LGA name ${state.name}/${lga.name}`);
      lgaCodes.add(lga.code);
      lgaNames.add(lgaName);
      if (state.type === "FCT" && lga.type !== "AREA_COUNCIL") {
        errors.push(`${state.name}/${lga.name} must be an Area Council`);
      }

      const wardCodes = new Set<string>();
      const wardNames = new Set<string>();
      for (const ward of lga.wards) {
        wardCount += 1;
        const wardName = ward.name.toLocaleLowerCase("en-NG");
        if (wardCodes.has(ward.code)) {
          errors.push(`Duplicate Ward code ${state.name}/${lga.name}/${ward.code}`);
        }
        if (wardNames.has(wardName)) {
          errors.push(`Duplicate Ward name ${state.name}/${lga.name}/${ward.name}`);
        }
        wardCodes.add(ward.code);
        wardNames.add(wardName);
      }
    }
  }

  const counts = { states: snapshot.states.length, lgas: lgaCount, wards: wardCount };
  for (const key of ["states", "lgas", "wards"] as const) {
    if (counts[key] !== snapshot.expectedCounts[key]) {
      errors.push(
        `${key} count mismatch: expected ${snapshot.expectedCounts[key]}, received ${counts[key]}`,
      );
    }
    if (counts[key] !== snapshot.counts[key]) {
      errors.push(`${key} count does not match snapshot metadata`);
    }
  }

  if (snapshot.states.filter((state) => state.type === "FCT").length !== 1) {
    errors.push("Exactly one FCT record is required");
  }
  return { counts, errors };
}
