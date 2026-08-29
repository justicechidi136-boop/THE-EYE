import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/location/citizen_location_details.dart";
import "package:the_eye_mobile/presentation/citizen_location_presentation.dart";

void main() {
  testWidgets("shows readable location, accuracy, then formatted capture time",
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: CitizenLocationDetails(
          address: "Stadium Road, Rumuola",
          secondaryLocation: "Port Harcourt, Rivers State",
          accuracyMeters: 19.6,
          capturedAt: DateTime.utc(2026, 8, 13, 11, 56),
        ),
      ),
    ));

    expect(find.text("Stadium Road, Rumuola\nPort Harcourt, Rivers State"),
        findsOneWidget);
    expect(find.text("GPS accuracy: 20 m"), findsOneWidget);
    expect(find.textContaining("Captured:"), findsOneWidget);
    expect(find.textContaining("2026-08-13T"), findsNothing);
  });

  testWidgets("gracefully reports unavailable address", (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: CitizenLocationDetails()),
    ));
    expect(find.text("Location unavailable"), findsOneWidget);
  });

  test(
      "keeps specific and administrative hierarchy and deprioritizes Plus Codes",
      () {
    const location = CitizenLocationPresentation(
      streetAddress: "8FVC9G8F+5W",
      subLocality: "Rumuola",
      cityTown: "Port Harcourt",
      lga: "Obio-Akpor",
      state: "Rivers State",
    );

    expect(location.specificLine, "Rumuola");
    expect(
      location.administrativeLine,
      "Port Harcourt, Obio-Akpor, Rivers State",
    );
    expect(location.label, isNot(contains("8FVC9G8F+5W")));
  });

  testWidgets("does not repeat administrative text already in full address",
      (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(
        body: CitizenLocationDetails(
          address: "Stadium Road, Port Harcourt, Rivers State",
          secondaryLocation: "Port Harcourt, Rivers State",
        ),
      ),
    ));

    expect(
      find.text("Stadium Road, Port Harcourt, Rivers State"),
      findsOneWidget,
    );
  });
}
