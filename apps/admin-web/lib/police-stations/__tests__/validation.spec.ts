import { parseCoordinatePair, validatePoliceStationForm } from "../validation";
import { defaultPoliceStationFormValues } from "../types";

describe("admin police station validation", () => {
  it("parses pasted coordinates", () => {
    expect(parseCoordinatePair("6.6018, 3.3515")).toEqual({ latitude: 6.6018, longitude: 3.3515 });
  });

  it("requires source metadata", () => {
    const result = validatePoliceStationForm({
      ...defaultPoliceStationFormValues,
      name: "Ikeja Central Police Station",
      address: "123 Allen Avenue, Ikeja",
      state: "Lagos",
      lga: "Ikeja",
      latitude: "6.6018",
      longitude: "3.3515",
    });
    expect(result.errors.source).toBeTruthy();
    expect(result.errors.sourceReference).toBeTruthy();
  });

  it("blocks Google-only verified official sources", () => {
    const result = validatePoliceStationForm({
      ...defaultPoliceStationFormValues,
      name: "Ikeja Central Police Station",
      address: "123 Allen Avenue, Ikeja",
      state: "Lagos",
      lga: "Ikeja",
      latitude: "6.6018",
      longitude: "3.3515",
      source: "Google Places",
      sourceReference: "place-id-123",
      verificationStatus: "VerifiedOfficial",
    });
    expect(result.errors.source).toContain("Google-only");
  });
});
