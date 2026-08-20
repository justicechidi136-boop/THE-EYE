import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/presentation/citizen_location_presentation.dart";

void main() {
  test("presents the most precise truthful citizen location", () {
    const location = CitizenLocationPresentation(
      streetAddress: "Stadium Road",
      subLocality: "Rumuola",
      cityTown: "Port Harcourt",
      lga: "Port Harcourt",
      state: "Rivers",
    );

    expect(location.lines, [
      "Stadium Road, Rumuola",
      "Port Harcourt, Rivers",
    ]);
    expect(location.label, isNot(contains("latitude")));
  });

  test("uses a safe fallback instead of technical coordinates", () {
    expect(const CitizenLocationPresentation().label, "Location unavailable");
  });
}
