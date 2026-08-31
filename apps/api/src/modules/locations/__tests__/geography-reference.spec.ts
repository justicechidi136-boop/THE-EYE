import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  loadGeographySnapshot,
  validateGeographySnapshot,
} from "../geography-reference";

describe("Nigeria geography reference data", () => {
  const snapshotPath = resolve("prisma/data/nigeria-geography.inec-2026-08-31.json");

  it("contains the complete validated Nigeria hierarchy", async () => {
    const snapshot = await loadGeographySnapshot(snapshotPath);
    const result = validateGeographySnapshot(snapshot);

    expect(result.errors).toEqual([]);
    expect(result.counts).toEqual({ states: 37, lgas: 774, wards: 8809 });
    expect(snapshot.country.code).toBe("NG");
  });

  it("keeps representative locations attached to the correct parents", async () => {
    const snapshot = await loadGeographySnapshot(snapshotPath);
    const cases = [
      ["Lagos", "Ikeja"],
      ["Kano", "Kano Municipal"],
      ["Rivers", "Port Harcourt"],
      ["Enugu", "Enugu North"],
      ["Borno", "Maiduguri M. C."],
      ["Benue", "Gwer East"],
    ];
    for (const [stateName, lgaName] of cases) {
      const state = snapshot.states.find((item) => item.name === stateName);
      const lga = state?.lgas.find((item) => item.name === lgaName);
      expect(Boolean(state)).toBe(true);
      expect(Boolean(lga)).toBe(true);
      expect((lga?.wards.length ?? 0) > 0).toBe(true);
    }
  });

  it("classifies all six FCT children as Area Councils", async () => {
    const snapshot = await loadGeographySnapshot(snapshotPath);
    const fct = snapshot.states.find((state) => state.type === "FCT");

    expect(fct?.lgas.length).toBe(6);
    expect(fct?.lgas.every((lga) => lga.type === "AREA_COUNCIL")).toBe(true);
  });

  it("documents and excludes the exact duplicate returned by the INEC locator", async () => {
    const snapshot = await loadGeographySnapshot(snapshotPath);
    const duplicate = snapshot.provenance.anomalies.find(
      (item) => item.type === "EXACT_DUPLICATE_WARD",
    );

    expect(duplicate).toEqual(
      expect.objectContaining({
        lgaName: "Gwer East",
        wardCode: "09",
        wardName: "Mbaikyaan",
        retainedSourceId: 1462,
        excludedSourceId: 8810,
      }),
    );
    expect(snapshot.rawCounts.wards).toBe(8810);
    expect(snapshot.counts.wards).toBe(8809);
  });

  it("enforces canonical parent chains in the additive migration", async () => {
    const migration = await readFile(
      resolve("prisma/migrations/20260831120000_nigeria_geography_agency_directory/migration.sql"),
      "utf8",
    );

    for (const constraint of [
      "jurisdictions_state_country_ref_fkey",
      "jurisdictions_lga_state_ref_fkey",
      "jurisdictions_ward_lga_ref_fkey",
      "agency_offices_state_country_fkey",
      "agency_offices_lga_state_fkey",
      "agency_offices_ward_lga_fkey",
      "agency_jurisdictions_state_country_fkey",
      "agency_jurisdictions_lga_state_fkey",
      "agency_jurisdictions_ward_lga_fkey",
    ]) {
      expect(migration).toContain(constraint);
    }
  });
});
