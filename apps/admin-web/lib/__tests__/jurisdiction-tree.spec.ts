import { buildJurisdictionRows } from "../jurisdiction-tree";

describe("jurisdiction-tree", () => {
  it("aggregates communities, users, and police stations by geography", () => {
    const rows = buildJurisdictionRows(
      [
        { country: "Nigeria", state: "Lagos", lga: "Ikeja", ward: "Ward A" },
        { country: "Nigeria", state: "Lagos", lga: "Ikeja", ward: "Ward B" },
      ],
      [{ country: "Nigeria", state: "Lagos", lga: "Ikeja" }],
      [{
        id: "1",
        name: "Station",
        phone: "-",
        officialPhone: "-",
        emergencyPhone: "-",
        address: "-",
        country: "Nigeria",
        state: "Lagos",
        lga: "Ikeja",
        latitude: 0,
        longitude: 0,
        agencyType: "Police",
        verificationStatus: "Verified",
        distance: "0m",
      }],
    );

    expect(rows.length).toBe(3);
    expect(rows.find((row) => row.ward === "Ward A")?.communities).toBe(1);
    expect(rows.find((row) => row.ward === "—" && row.lga === "Ikeja")?.users).toBe(1);
    expect(rows.find((row) => row.ward === "—" && row.lga === "Ikeja")?.policeStations).toBe(1);
  });
});
