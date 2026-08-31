import { resolve } from "node:path";
import {
  loadAgencySeed,
  normalizeFederalFormations,
  preserveStrongerVerification,
  validateAgencySeed,
} from "../agency-reference";

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

  it("validates Wave 2 State agencies and federal formations without duplicate parents", async () => {
    const document = await loadAgencySeed(resolve("prisma/data/nigeria-state-agencies.wave2-2026-08-31.json"));

    expect(validateAgencySeed(document)).toEqual([]);
    expect(document.agencies.length).toBe(9);
    expect(document.federalFormations?.length).toBe(5);
    expect(document.federalFormations?.every((formation) => formation.parentAgencyCode === "NG-FRSC")).toBe(true);
    expect(document.agencies.some((agency) => agency.code === "NG-FRSC")).toBe(false);
    expect(document.agencies.every((agency) => Boolean(agency.stateName))).toBe(true);
  });

  it("rejects emergency contact classification without explicit source evidence", async () => {
    const document = await loadAgencySeed(resolve("prisma/data/nigeria-state-agencies.wave2-2026-08-31.json"));
    const invalid = structuredClone(document);
    invalid.agencies[0].contacts[0].emergencyUseVerified = false;

    expect(validateAgencySeed(invalid).some((error) => error.includes("explicit classification evidence"))).toBe(true);
  });

  it("validates nationwide federal commands and multi-State fire zones without duplicate agencies", async () => {
    const document = await loadAgencySeed(resolve("prisma/data/nigeria-federal-formations.national-2026-08-31.json"));
    const formations = normalizeFederalFormations(document);

    expect(validateAgencySeed(document)).toEqual([]);
    expect(document.agencies).toEqual([]);
    expect(formations.length).toBe(129);
    expect(formations.filter((formation) => formation.parentAgencyCode === "NG-NPF").length).toBe(37);
    expect(formations.filter((formation) => formation.parentAgencyCode === "NG-NSCDC").length).toBe(37);
    expect(formations.filter((formation) => formation.parentAgencyCode === "NG-FRSC").length).toBe(37);
    expect(formations.filter((formation) => formation.parentAgencyCode === "NG-FFS").length).toBe(18);
    expect(formations.every((formation) => formation.jurisdictionStateNames.length > 0)).toBe(true);
  });

  it("validates N5 operational records without inferred coordinates or emergency classifications", async () => {
    const document = await loadAgencySeed(resolve("prisma/data/nigeria-state-agencies.n5-operational-2026-08-31.json"));

    expect(validateAgencySeed(document)).toEqual([]);
    expect(document.agencies.length).toBe(5);
    expect(document.agencies.every((agency) => Boolean(agency.office?.address))).toBe(true);
    expect(document.agencies.every((agency) => !Object.prototype.hasOwnProperty.call(agency.office ?? {}, "latitude"))).toBe(true);
    const ordinaryPhones = document.agencies.flatMap((agency) => agency.contacts)
      .filter((contact) => contact.type === "PHONE");
    expect(ordinaryPhones.every((contact) => contact.emergencyOnly !== true)).toBe(true);
    expect(document.agencies.find((agency) => agency.code === "NG-OYO-FIRE")?.contacts
      .some((contact) => contact.type === "TOLL_FREE" && contact.emergencyUseVerified)).toBe(true);
  });

  it("rejects duplicate canonical jurisdictions inside a federal formation", async () => {
    const document = await loadAgencySeed(resolve("prisma/data/nigeria-federal-formations.national-2026-08-31.json"));
    const invalid = structuredClone(document);
    invalid.federalFormationGroups![0].formations[0].jurisdictionStateNames = ["Abia", "Abia"];

    expect(validateAgencySeed(invalid).some((error) => error.includes("duplicate canonical jurisdiction"))).toBe(true);
  });

  it("preserves stronger verification evidence during re-import", () => {
    expect(preserveStrongerVerification("VERIFIED", "PARTIALLY_VERIFIED")).toBe("VERIFIED");
    expect(preserveStrongerVerification("PARTIALLY_VERIFIED", "VERIFIED")).toBe("VERIFIED");
    expect(preserveStrongerVerification(undefined, "PARTIALLY_VERIFIED")).toBe("PARTIALLY_VERIFIED");
    expect(preserveStrongerVerification("RETIRED", "VERIFIED")).toBe("RETIRED");
    expect(preserveStrongerVerification("DISPUTED", "VERIFIED")).toBe("DISPUTED");
  });
});
