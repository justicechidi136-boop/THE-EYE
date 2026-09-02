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

  test("never exposes a Plus Code as the citizen street label", () {
    const location = CitizenLocationPresentation(
      streetAddress: "8FVC9G8F+5W",
      lga: "Obio-Akpor",
      state: "Rivers State",
    );

    expect(location.specificLine, isEmpty);
    expect(location.label, "Obio-Akpor, Rivers State");
  });
}
