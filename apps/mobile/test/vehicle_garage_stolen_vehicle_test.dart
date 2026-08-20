import "dart:convert";

import "package:connectivity_plus/connectivity_plus.dart";
import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";
import "package:shared_preferences/shared_preferences.dart";

import "package:the_eye_mobile/auth/auth_service.dart";
import "package:the_eye_mobile/auth/auth_session_store.dart";
import "package:the_eye_mobile/auth/social_auth_service.dart";
import "package:the_eye_mobile/connectivity/connectivity_service.dart";
import "package:the_eye_mobile/connectivity/network_interface_reader.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/contracts/the_eye_api_paths.dart";
import "package:the_eye_mobile/incidents/incident_submission_service.dart";
import "package:the_eye_mobile/incidents/pending_submission_store.dart";
import "package:the_eye_mobile/l10n/generated/app_localizations.dart";
import "package:the_eye_mobile/main.dart";
import "package:the_eye_mobile/profile/car_profile.dart";
import "package:the_eye_mobile/profile/car_profile_store.dart";
import "package:the_eye_mobile/theme/theme_preferences.dart";
import "package:the_eye_mobile/theme/theme_provider.dart";

import "support/fake_google_sign_in.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets("stolen vehicle screen requires explicit entry choice",
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final themeProvider =
        ThemeProvider(ThemePreferences(await SharedPreferences.getInstance()));
    final garage = InMemoryVehicleGarageStore()
      ..vehicles = const [
        CarProfile(
          id: "v1",
          make: "Toyota",
          model: "Corolla",
          plateNumber: "ABC-111",
          color: "Silver",
          isPrimary: true,
        ),
        CarProfile(
          id: "v2",
          make: "Honda",
          model: "Civic",
          plateNumber: "ABC-222",
        ),
      ];
    final controller = _testController(themeProvider, garage);
    await tester.pump();
    await tester.pump();

    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: AppScope(
          controller: controller,
          child: const StolenVehicleBroadcastScreen(),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.text("Use Saved Vehicle"), findsOneWidget);
    expect(find.text("Enter Vehicle Manually"), findsOneWidget);
    expect(find.text("Plate number"), findsNothing);
  });

  testWidgets("stolen vehicle screen shows saved-vehicle selector state",
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final themeProvider =
        ThemeProvider(ThemePreferences(await SharedPreferences.getInstance()));
    final garage = InMemoryVehicleGarageStore()
      ..vehicles = const [
        CarProfile(
          id: "v1",
          make: "Toyota",
          model: "Corolla",
          plateNumber: "ABC-111",
          color: "Silver",
          isPrimary: true,
        ),
        CarProfile(
          id: "v2",
          make: "Honda",
          model: "Civic",
          plateNumber: "ABC-222",
          color: "Black",
        ),
      ];
    final controller = _testController(themeProvider, garage);
    await tester.pump();
    await tester.pump();

    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: AppScope(
          controller: controller,
          child: const StolenVehicleBroadcastScreen(),
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text("Use Saved Vehicle"));
    await tester.pumpAndSettle();

    expect(find.text("Select Vehicle"), findsOneWidget);
    expect(find.textContaining("Toyota Corolla"), findsOneWidget);
    expect(find.textContaining("Honda Civic"), findsOneWidget);
    expect(find.text("PRIMARY"), findsOneWidget);
  });

  testWidgets("stolen vehicle screen shows empty saved-vehicle state",
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final themeProvider =
        ThemeProvider(ThemePreferences(await SharedPreferences.getInstance()));
    final controller =
        _testController(themeProvider, InMemoryVehicleGarageStore());
    await tester.pump();

    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: AppScope(
          controller: controller,
          child: const StolenVehicleBroadcastScreen(),
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text("Use Saved Vehicle"));
    await tester.pumpAndSettle();

    expect(find.text("NO SAVED VEHICLES"), findsOneWidget);
    expect(find.text("You haven't added any vehicles yet."), findsOneWidget);
    expect(find.text("Add Vehicle"), findsOneWidget);
    expect(find.text("Enter Vehicle Manually"), findsOneWidget);
  });

  testWidgets(
      "stolen vehicle screen preserves draft when adding a vehicle then returns to selector",
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final themeProvider =
        ThemeProvider(ThemePreferences(await SharedPreferences.getInstance()));
    final garage = InMemoryVehicleGarageStore()
      ..vehicles = const [
        CarProfile(
          id: "v1",
          make: "Toyota",
          model: "Corolla",
          plateNumber: "ABC-111",
          color: "Silver",
          isPrimary: true,
        ),
      ];
    final controller = _testController(themeProvider, garage);
    await tester.pump();
    await tester.pump();

    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: AppScope(
          controller: controller,
          child: const StolenVehicleBroadcastScreen(),
        ),
        routes: {
          "/your-car/detail": (context) => Scaffold(
                body: Center(
                  child: FilledButton(
                    onPressed: () {
                      garage.vehicles = const [
                        CarProfile(
                          id: "v1",
                          make: "Toyota",
                          model: "Corolla",
                          plateNumber: "ABC-111",
                          color: "Silver",
                          isPrimary: true,
                        ),
                        CarProfile(
                          id: "v3",
                          make: "Nissan",
                          model: "Altima",
                          plateNumber: "ABC-333",
                          color: "Blue",
                        ),
                      ];
                      Navigator.of(context).pop("v3");
                    },
                    child: const Text("Save vehicle"),
                  ),
                ),
              ),
        },
      ),
    );
    await tester.pump();

    await tester.tap(find.text("Enter Vehicle Manually"));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).at(0), "DRAFT-999");
    await tester.enterText(find.byType(TextField).at(1), "DraftMake");
    await tester.enterText(find.byType(TextField).at(2), "DraftModel");
    await tester.pump();

    await tester.tap(find.text("Use Saved Vehicle"));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Add Vehicle").first);
    await tester.pumpAndSettle();
    await tester.tap(find.text("Save vehicle"));
    await tester.pumpAndSettle();

    expect(find.text("Select Vehicle"), findsOneWidget);
    expect(find.textContaining("Nissan Altima"), findsOneWidget);
    expect(find.text("DRAFT-999"), findsNothing);

    await tester.tap(find.text("Enter Vehicle Manually"));
    await tester.pumpAndSettle();
    expect(find.text("DRAFT-999"), findsOneWidget);
    expect(find.text("DraftMake"), findsOneWidget);
    expect(find.text("DraftModel"), findsOneWidget);
  });

  testWidgets("stolen vehicle screen supports selecting second saved vehicle",
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final themeProvider =
        ThemeProvider(ThemePreferences(await SharedPreferences.getInstance()));
    final garage = InMemoryVehicleGarageStore()
      ..vehicles = const [
        CarProfile(
          id: "v1",
          make: "Toyota",
          model: "Corolla",
          plateNumber: "ABC-111",
          color: "Silver",
          isPrimary: true,
        ),
        CarProfile(
          id: "v2",
          make: "Honda",
          model: "Civic",
          plateNumber: "ABC-222",
          color: "Black",
        ),
      ];
    final controller = _testController(themeProvider, garage);
    await tester.pump();
    await tester.pump();

    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: AppScope(
          controller: controller,
          child: const StolenVehicleBroadcastScreen(),
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text("Use Saved Vehicle"));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining("Honda Civic"));
    await tester.pumpAndSettle();

    expect(find.text("Select Vehicle"), findsNothing);
    expect(find.textContaining("Toyota Corolla"), findsNothing);
    expect(find.text("Change vehicle"), findsOneWidget);
    expect(find.text("ABC-222"), findsAtLeastNWidgets(1));
    expect(find.text("Honda"), findsAtLeastNWidgets(1));
    expect(find.text("Civic"), findsAtLeastNWidgets(1));

    await tester.tap(find.text("Change vehicle"));
    await tester.pumpAndSettle();
    expect(find.text("Select Vehicle"), findsOneWidget);
    expect(find.textContaining("Toyota Corolla"), findsOneWidget);
  });

  testWidgets("saved vehicle selection replaces stale manual vehicle fields",
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final themeProvider =
        ThemeProvider(ThemePreferences(await SharedPreferences.getInstance()));
    final garage = InMemoryVehicleGarageStore()
      ..vehicles = const [
        CarProfile(
          id: "v2",
          make: "Honda",
          model: "Civic",
          plateNumber: "ABC-222",
          color: "Black",
        ),
      ];
    final controller = _testController(themeProvider, garage);
    await tester.pump();

    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: AppScope(
          controller: controller,
          child: const StolenVehicleBroadcastScreen(),
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text("Enter Vehicle Manually"));
    await tester.pumpAndSettle();
    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), "DraftMake");
    await tester.enterText(fields.at(1), "DraftModel");
    await tester.enterText(fields.at(4), "DRAFT-999");
    await tester.enterText(fields.at(8), "Stale manual description");

    final savedMode = find.text("Use Saved Vehicle");
    await tester.ensureVisible(savedMode);
    await tester.tap(savedMode);
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining("Honda Civic"));
    await tester.pumpAndSettle();

    final populated = tester
        .widgetList<TextField>(find.byType(TextField))
        .map((field) => field.controller?.text)
        .toList();
    expect(populated[0], "Honda");
    expect(populated[1], "Civic");
    expect(populated[4], "ABC-222");
    expect(populated[8], isEmpty);
    expect(find.text("Select Vehicle"), findsNothing);
  });

  testWidgets(
      "stolen vehicle screen allows manual entry without saved vehicle selection",
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final themeProvider =
        ThemeProvider(ThemePreferences(await SharedPreferences.getInstance()));
    final controller =
        _testController(themeProvider, InMemoryVehicleGarageStore());
    await tester.pump();

    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: AppScope(
          controller: controller,
          child: const StolenVehicleBroadcastScreen(),
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text("Enter Vehicle Manually"));
    await tester.pumpAndSettle();

    expect(find.text("Use Saved Vehicle"), findsNothing);
    expect(find.text("Plate number"), findsOneWidget);
    expect(find.byType(TextField), findsWidgets);
  });
}

AppController _testController(
  ThemeProvider themeProvider,
  VehicleGarageStore garageStore,
) {
  final apiClient = TheEyeApiClient(
    baseUrl: "http://localhost:4000/v1",
    httpClient: MockClient((request) async {
      if (request.url.path.endsWith(TheEyeApiPaths.health)) {
        return http.Response(jsonEncode({"status": "ok"}), 200);
      }
      return http.Response("Not found", 404);
    }),
  );

  return AppController(
    apiClient: apiClient,
    submissionService: IncidentSubmissionService(
      apiClient: apiClient,
      pendingStore: InMemoryPendingSubmissionStore(),
    ),
    connectivity: ConnectivityService(
      apiClient: apiClient,
      networkReader:
          FakeNetworkInterfaceReader(initial: [ConnectivityResult.wifi]),
      debounceDelay: Duration.zero,
    ),
    authService: AuthService(
      apiClient: apiClient,
      sessionStore: InMemoryAuthSessionStore(),
    ),
    socialAuthService: SocialAuthService(
      apiClient: apiClient,
      sessionStore: InMemoryAuthSessionStore(),
      googleSignIn: FakeGoogleSignIn(),
    ),
    authSessionStore: InMemoryAuthSessionStore(),
    themeProvider: themeProvider,
    vehicleGarageStore: garageStore,
  );
}
