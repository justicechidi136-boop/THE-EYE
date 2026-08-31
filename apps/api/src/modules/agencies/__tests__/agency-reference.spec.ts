import { resolve } from "node:path";
import { loadAgencySeed, validateAgencySeed } from "../agency-reference";

describe("verified Nigeria agency reference seed", () => {
  it("contains only provenance-complete, duplicate-safe seed entries", async () => {
    const document = await loadAgencySeed(resolve("prisma/data/nigeria-federal-agencies.official-2026-08-31.json"));

    expect(validateAgencySeed(document)).toEqual([]);
    expect(document.countryCode).toBe("NG");
    expect(document.agencies.length).toBe(5);
    expect(new Set(document.agencies.map((agency) => agency.code)).size).toBe(5);
  });

  it("rejects a verified public contact without secure provenance", async () => {
    const document = await loadAgencySeed(resolve("prisma/data/nigeria-federal-agencies.official-2026-08-31.json"));
    const invalid = structuredClone(document);
    invalid.agencies[0].contacts[0].sourceUrl = "http://unverified.example/contact";

    expect(validateAgencySeed(invalid).some((error) => error.includes("HTTPS provenance"))).toBe(true);
  });

  it("contains only canonical, provenance-complete State wave records", async () => {
    const document = await loadAgencySeed(resolve("prisma/data/nigeria-state-agencies.wave1-2026-08-31.json"));

    expect(validateAgencySeed(document)).toEqual([]);
    expect(document.agencies.length).toBe(2);
    expect(document.agencies.map((agency) => agency.stateName)).toEqual(["Benue", "Rivers"]);
    expect(document.agencies.every((agency) => agency.governmentLevel === "STATE")).toBe(true);
  });

  it("rejects a State agency without a canonical State name", async () => {
    const document = await loadAgencySeed(resolve("prisma/data/nigeria-state-agencies.wave1-2026-08-31.json"));
    const invalid = structuredClone(document);
    delete invalid.agencies[0].stateName;

    expect(validateAgencySeed(invalid).some((error) => error.includes("requires stateName"))).toBe(true);
  });
});
