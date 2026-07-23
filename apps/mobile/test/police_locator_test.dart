import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/police/police_stations_screen.dart";
import "package:the_eye_mobile/police/police_stations_service.dart";

void main() {
  test("PoliceStationItem labels verified and Google sources", () {
    const verified = PoliceStationItem(
      id: "1",
      name: "Ikeja Central Police Station",
      phone: "+2348000003001",
      address: "Ikeja",
      agencyType: "police",
      latitude: 6.6,
      longitude: 3.35,
      verificationStatus: PoliceVerificationStatus.verifiedOfficial,
    );
    const google = PoliceStationItem(
      id: "google:ChIJ",
      name: "Area Command",
      phone: null,
      address: "Allen Avenue",
      agencyType: "police",
      latitude: 6.61,
      longitude: 3.36,
      dataSource: PoliceDataSource.googlePlaces,
      verificationStatus: PoliceVerificationStatus.googleMapsResult,
    );

    expect(verified.isVerifiedByTheEye, isTrue);
    expect(google.isGoogleResult, isTrue);
    expect(google.canCall, isFalse);
    expect(verified.canCall, isTrue);
  });

  testWidgets("NearbyPoliceStationsScreen shows back header without autoload",
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: NearbyPoliceStationsScreen(autoload: false),
      ),
    );
    await tester.pump();

    expect(find.text("Nearby police"), findsWidgets);
    expect(find.byTooltip("Back"), findsOneWidget);
  });
}
