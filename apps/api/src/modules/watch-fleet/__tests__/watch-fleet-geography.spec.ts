import { buildGeographyDeviceWhere, decodeOwnerSummaryCursor, encodeOwnerSummaryCursor } from "../watch-fleet-geography";

describe("watch fleet geography helpers", () => {
  it("builds prisma geography filter for scoped admins", () => {
    const where = buildGeographyDeviceWhere({ country: "Nigeria", state: "Lagos", lga: "Ikeja" });
    expect(where != null).toBe(true);
    expect(where != null && "OR" in where).toBe(true);
  });

  it("returns undefined for super-admin scope", () => {
    expect(buildGeographyDeviceWhere(null) == null).toBe(true);
  });

  it("round-trips owner summary cursor", () => {
    const encoded = encodeOwnerSummaryCursor(1200, "PERSON", "user-1");
    const decoded = decodeOwnerSummaryCursor(encoded);
    expect(decoded?.total).toBe(1200);
    expect(decoded?.ownerType).toBe("PERSON");
    expect(decoded?.ownerId).toBe("user-1");
  });
});
