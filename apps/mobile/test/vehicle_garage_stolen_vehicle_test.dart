import "dart:convert";

import "package:connectivity_plus/connectivity_plus.dart";
import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";
import "package:shared_preferences/shared_preferences.dart";

import "package:the_eye_mobile/app/app_scope.dart";
import "package:the_eye_mobile/auth/auth_service.dart";
import "package:the_eye_mobile/auth/auth_session_store.dart";
import "package:the_eye_mobile/auth/social_auth_service.dart";
import "package:the_eye_mobile/connectivity/connectivity_service.dart";
import "package:the_eye_mobile/connectivity/network_interface_reader.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/contracts/the_eye_api_paths.dart";
import "package:the_eye_mobile/incidents/incident_submission_service.dart";
import "package:the_eye_mobile/incidents/pending_submission_store.dart";
import "package:the_eye_mobile/main.dart";
import "package:the_eye_mobile/profile/car_profile.dart";
import "package:the_eye_mobile/profile/car_profile_store.dart";
import "package:the_eye_mobile/theme/theme_preferences.dart";
import "package:the_eye_mobile/theme/theme_provider.dart";

import "support/fake_google_sign_in.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets("stolen vehicle screen pre-fills from primary garage vehicle",
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final themeProvider =
        ThemeProvider(ThemePreferences(await SharedPreferences.getInstance()));
    final controller = _testController(themeProvider);
    controller.vehicles = const [
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

    await tester.pumpWidget(
      MaterialApp(
        home: AppScope(
          controller: controller,
          child: const StolenVehicleBroadcastScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("ABC-111"), findsOneWidget);
    expect(find.text("Toyota"), findsOneWidget);
    expect(find.text("Corolla"), findsOneWidget);
  });

  testWidgets(
      "stolen vehicle screen allows manual entry without saved vehicle selection",
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final themeProvider =
        ThemeProvider(ThemePreferences(await SharedPreferences.getInstance()));
    final controller = _testController(themeProvider);
    controller.vehicles = const [];

    await tester.pumpWidget(
      MaterialApp(
        home: AppScope(
          controller: controller,
          child: const StolenVehicleBroadcastScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("Select from My Cars (optional)"), findsNothing);
    expect(find.byType(TextField), findsWidgets);
  });
}

AppController _testController(ThemeProvider themeProvider) {
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
    vehicleGarageStore: InMemoryVehicleGarageStore(),
  );
}
