import { projectBroadcastNotificationMetadata } from "../broadcasts.service";

describe("broadcast notification metadata", () => {
  it("keeps only trusted presentation fields", () => {
    const projected = projectBroadcastNotificationMetadata({
      make: "Toyota",
      model: "Corolla",
      colour: "Yellow",
      registrationMasked: "PHC 213BJ",
      stolenAt: "2026-08-13T13:45:00.000Z",
      vin: "SHOULD-NOT-LEAK",
      exactReporterCoordinates: "SHOULD-NOT-LEAK",
    });

    expect(projected).toEqual({
      make: "Toyota",
      model: "Corolla",
      colour: "Yellow",
      registrationMasked: "PHC 213BJ",
      stolenAt: "2026-08-13T13:45:00.000Z",
    });
    expect(Object.prototype.hasOwnProperty.call(projected, "vin")).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(
        projected,
        "exactReporterCoordinates",
      ),
    ).toBe(false);
  });
});
