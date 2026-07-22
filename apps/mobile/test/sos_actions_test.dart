import "dart:convert";

import "package:connectivity_plus/connectivity_plus.dart";
import "package:shared_preferences/shared_preferences.dart";
import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:geolocator/geolocator.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";

import "package:the_eye_mobile/auth/auth_service.dart";
import "package:the_eye_mobile/auth/auth_session_store.dart";
import "package:the_eye_mobile/auth/social_auth_service.dart";
import "package:the_eye_mobile/connectivity/connectivity_service.dart";
import "package:the_eye_mobile/connectivity/network_interface_reader.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/contracts/the_eye_api_paths.dart";
import "package:the_eye_mobile/incidents/incident_submission_service.dart";
import "package:the_eye_mobile/incidents/pending_submission_store.dart";
import "package:the_eye_mobile/live_video/live_video_session_controller.dart";
import "package:the_eye_mobile/main.dart";
import "package:the_eye_mobile/profile/car_profile_store.dart";
import "package:the_eye_mobile/theme/theme_preferences.dart";
import "package:the_eye_mobile/theme/theme_provider.dart";

import "support/fake_google_sign_in.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late ThemeProvider themeProvider;

  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    themeProvider =
        ThemeProvider(ThemePreferences(await SharedPreferences.getInstance()));
  });

  setUp(() {
    GeolocatorPlatform.instance = _ImmediateLocationPlatform();
  });

  test("LiveVideoRouteArgs carries autoStartStream for SOS live video", () {
    const args = LiveVideoRouteArgs(autoStartStream: true);
    expect(args.autoStartStream, isTrue);

    const plain = LiveVideoRouteArgs();
    expect(plain.autoStartStream, isFalse);
  });

  test("locationFailureMessage describes GPS timeout", () {
    expect(
      locationFailureMessage(LocationCaptureResult.timeout),
      "Could not get GPS in time. Move to an open area and try again.",
    );
  });

  test("kLocationCaptureTimeout is within emergency capture window", () {
    expect(kLocationCaptureTimeout.inSeconds, greaterThanOrEqualTo(15));
    expect(kLocationCaptureTimeout.inSeconds, lessThanOrEqualTo(30));
  });

  test("SOS and live video timeouts are bounded for emergency flows", () {
    expect(kSosSubmissionTimeout.inSeconds, greaterThanOrEqualTo(30));
    expect(kLiveVideoStartTimeout.inSeconds, greaterThanOrEqualTo(30));
    expect(kLocationPermissionTimeout.inSeconds, greaterThanOrEqualTo(10));
    expect(LiveVideoSessionController.connectTimeout.inSeconds,
        greaterThanOrEqualTo(15));
  });

  testWidgets("SafetyScaffold Eye button opens distinct SOS action sheet",
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: AppScope(
          controller: _testController(themeProvider),
          child: const SafetyScaffold(
            title: "Test",
            useFigmaShell: true,
            body: SizedBox.shrink(),
          ),
        ),
      ),
    );

    await tester.tap(find.bySemanticsLabel("Send SOS emergency alert"));
    await tester.pumpAndSettle();

    expect(find.text("Send SOS now"), findsOneWidget);
    expect(find.text("Start SOS live video"), findsOneWidget);
    expect(find.text("Sending SOS..."), findsNothing);
  });

  testWidgets("Send SOS now dismisses action sheet immediately",
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: AppScope(
          controller: _testController(themeProvider),
          child: const SafetyScaffold(
            title: "Test",
            useFigmaShell: true,
            body: SizedBox.shrink(),
          ),
        ),
      ),
    );

    await tester.tap(find.bySemanticsLabel("Send SOS emergency alert"));
    await tester.pumpAndSettle();

    await tester.tap(find.text("Send SOS now"));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));

    expect(find.text("Send SOS alert?"), findsNothing);
  });
}

AppController _testController(ThemeProvider themeProvider) {
  final apiClient = TheEyeApiClient(
    baseUrl: "http://localhost:4000/v1",
    httpClient: MockClient((request) async {
      if (request.url.path.endsWith(TheEyeApiPaths.incidentsReport)) {
        return http.Response(
          jsonEncode({
            "id": "incident-sos-test",
            "status": "Submitted",
            "submittedAt": "2026-07-10T01:31:00.000Z",
          }),
          200,
          headers: {"content-type": "application/json"},
        );
      }
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
    carProfileStore: InMemoryCarProfileStore(),
  );
}

class _ImmediateLocationPlatform extends GeolocatorPlatform {
  @override
  Future<LocationPermission> checkPermission() async =>
      LocationPermission.always;

  @override
  Future<LocationPermission> requestPermission() async =>
      LocationPermission.always;

  @override
  Future<bool> isLocationServiceEnabled() async => true;

  @override
  Future<Position> getCurrentPosition(
      {LocationSettings? locationSettings}) async {
    return Position(
      latitude: 6.5244,
      longitude: 3.3792,
      timestamp: DateTime.now(),
      accuracy: 5,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );
  }
}
