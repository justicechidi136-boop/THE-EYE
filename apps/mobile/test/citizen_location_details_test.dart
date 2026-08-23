import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/location/citizen_location_details.dart";

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
}
