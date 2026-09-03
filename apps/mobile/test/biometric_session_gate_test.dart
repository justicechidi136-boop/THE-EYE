import "dart:convert";
import "dart:io";

import "package:connectivity_plus/connectivity_plus.dart";
import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";
import "package:local_auth/local_auth.dart";
import "package:shared_preferences/shared_preferences.dart";

import "package:the_eye_mobile/auth/auth_persistence_preference_store.dart";
import "package:the_eye_mobile/auth/auth_service.dart";
import "package:the_eye_mobile/auth/auth_session_store.dart";
import "package:the_eye_mobile/auth/biometric_auth_service.dart";
import "package:the_eye_mobile/auth/biometric_preference_store.dart";
import "package:the_eye_mobile/auth/social_auth_service.dart";
import "package:the_eye_mobile/connectivity/connectivity_service.dart";
import "package:the_eye_mobile/connectivity/network_interface_reader.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/contracts/the_eye_api_paths.dart";
import "package:the_eye_mobile/incidents/incident_submission_service.dart";
import "package:the_eye_mobile/incidents/pending_submission_store.dart";
import "package:the_eye_mobile/main.dart";
import "package:the_eye_mobile/profile/car_profile_store.dart";
import "package:the_eye_mobile/theme/theme_preferences.dart";
import "package:the_eye_mobile/theme/theme_provider.dart";

import "support/fake_google_sign_in.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test("enabled biometric keeps persisted session locked during cold start",
      () async {
    final fixture = await _buildFixture(biometricAccountId: "citizen-1");

    await fixture.controller.loadPersistedSession();

    expect(fixture.controller.biometricUnlockRequired, isTrue);
    expect(fixture.controller.isAuthenticated, isFalse);
    expect(
      (await fixture.controller.restoreSession()).status,
      SessionRestoreStatus.biometricRequired,
    );
  });

  test("successful biometric unlock restores the bound account", () async {
    final fixture = await _buildFixture(biometricAccountId: "citizen-1");
    await fixture.controller.loadPersistedSession();

    final result = await fixture.controller.unlockWithBiometrics();

    expect(result.isSuccess, isTrue);
    expect(fixture.controller.isAuthenticated, isTrue);
    expect(fixture.controller.biometricUnlockRequired, isFalse);
    expect(fixture.gateway.authenticationCalls, 1);
  });

  testWidgets("login screen automatically offers native biometric unlock",
      (tester) async {
    final fixture = await _buildFixture(biometricAccountId: "citizen-1");
    await fixture.controller.loadPersistedSession();

    await tester.pumpWidget(
      AppScope(
        controller: fixture.controller,
        child: MaterialApp(
          routes: {
            "/home": (_) => const Scaffold(body: Text("Unlocked home")),
          },
          home: const LoginRegisterScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("Unlocked home"), findsOneWidget);
    expect(fixture.gateway.authenticationCalls, 1);
  });

  testWidgets("failed biometric can retry while password fallback remains",
      (tester) async {
    final fixture = await _buildFixture(
      biometricAccountId: "citizen-1",
      authenticationResult: false,
    );
    await fixture.controller.loadPersistedSession();

    await tester.pumpWidget(
      AppScope(
        controller: fixture.controller,
        child: const MaterialApp(home: LoginRegisterScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(fixture.gateway.authenticationCalls, 1);
    expect(find.text("Unlock with Biometric"), findsOneWidget);
    expect(find.text("Email"), findsOneWidget);
    expect(find.text("Password"), findsOneWidget);

    await tester.tap(find.text("Unlock with Biometric"));
    await tester.pumpAndSettle();

    expect(fixture.gateway.authenticationCalls, 2);
    expect(fixture.controller.biometricUnlockRequired, isTrue);
    expect((await fixture.biometrics.load()).enabled, isTrue);
  });

  test("account mismatch fails closed and clears saved credentials", () async {
    final fixture = await _buildFixture(biometricAccountId: "another-user");
    await fixture.controller.loadPersistedSession();

    final result = await fixture.controller.unlockWithBiometrics();

    expect(result.isSuccess, isFalse);
    expect(fixture.controller.isAuthenticated, isFalse);
    expect(await fixture.sessions.load(), isNull);
    expect((await fixture.biometrics.load()).enabled, isFalse);
  });

  test("cancelled biometric prompt keeps the session locked and recoverable",
      () async {
    final fixture = await _buildFixture(
      biometricAccountId: "citizen-1",
      authenticationResult: const LocalAuthException(
        code: LocalAuthExceptionCode.userCanceled,
      ),
    );
    await fixture.controller.loadPersistedSession();

    final result = await fixture.controller.unlockWithBiometrics();

    expect(result.status, BiometricAuthenticationStatus.cancelled);
    expect(fixture.controller.biometricUnlockRequired, isTrue);
    expect(fixture.controller.isAuthenticated, isFalse);
    expect(await fixture.sessions.load(), isNotNull);
  });

  test("successful biometric unlock preserves and opens an offline session",
      () async {
    final fixture = await _buildFixture(
      biometricAccountId: "citizen-1",
      profileFailure: const SocketException("offline"),
    );
    await fixture.controller.loadPersistedSession();

    final result = await fixture.controller.unlockWithBiometrics();

    expect(result.status, BiometricAuthenticationStatus.success);
    expect(fixture.controller.isAuthenticated, isTrue);
    expect(fixture.controller.authState, AppAuthState.authenticated);
    expect(fixture.controller.biometricUnlockRequired, isFalse);
    expect(await fixture.sessions.load(), isNotNull);
    expect((await fixture.biometrics.load()).enabled, isTrue);
  });

  test("manual password fallback preserves the biometric preference", () async {
    final fixture = await _buildFixture(biometricAccountId: "citizen-1");
    await fixture.controller.loadPersistedSession();

    await fixture.controller.setSession(
      const AuthSession(
        accessToken: "new-access-token-long",
        refreshToken: "new-refresh-token-long",
      ),
    );

    expect(fixture.controller.isAuthenticated, isTrue);
    expect((await fixture.biometrics.load()).enabled, isTrue);
    expect((await fixture.biometrics.load()).accountId, "citizen-1");
  });

  test("signing into another account clears the old biometric binding",
      () async {
    final fixture = await _buildFixture(
      biometricAccountId: "citizen-1",
      profileId: "citizen-2",
    );
    await fixture.controller.loadPersistedSession();

    await fixture.controller.setSession(
      const AuthSession(
        accessToken: "new-access-token-long",
        refreshToken: "new-refresh-token-long",
      ),
    );

    expect((await fixture.biometrics.load()).enabled, isFalse);
  });

  test("explicit biometric lock preserves the persisted session", () async {
    final fixture = await _buildFixture(biometricAccountId: "citizen-1");
    await fixture.controller.loadPersistedSession();

    await fixture.controller.lockSessionForBiometrics();

    expect(await fixture.sessions.load(), isNotNull);
    expect((await fixture.biometrics.load()).enabled, isTrue);
    expect(fixture.controller.isAuthenticated, isFalse);
    expect(fixture.controller.biometricUnlockRequired, isTrue);
  });

  test("manual sign-out revokes the session and clears biometric binding",
      () async {
    final fixture = await _buildFixture(biometricAccountId: "citizen-1");
    await fixture.controller.loadPersistedSession();

    await fixture.controller.clearSession();

    expect(await fixture.sessions.load(), isNull);
    expect((await fixture.biometrics.load()).enabled, isFalse);
  });

  test("turning off remain signed in also disables biometric unlock", () async {
    final fixture = await _buildFixture(biometricAccountId: "citizen-1");
    await fixture.controller.loadPersistedSession();

    await fixture.controller.setRemainSignedIn(false);

    expect(fixture.controller.remainSignedIn, isFalse);
    expect((await fixture.biometrics.load()).enabled, isFalse);
  });

  test("enabling biometrics is explicit, verifies identity, and binds account",
      () async {
    final fixture = await _buildFixture(remainSignedIn: false);
    await fixture.controller.loadPersistedSession();

    final status = await fixture.controller.enableBiometricUnlock();

    expect(status, BiometricAuthenticationStatus.success);
    expect(fixture.gateway.authenticationCalls, 1);
    expect(fixture.controller.remainSignedIn, isTrue);
    expect((await fixture.biometrics.load()).accountId, "citizen-1");
  });
}

Future<_Fixture> _buildFixture({
  String? biometricAccountId,
  String profileId = "citizen-1",
  bool remainSignedIn = true,
  Object authenticationResult = true,
  Object? profileFailure,
}) async {
  SharedPreferences.setMockInitialValues({
    AuthPersistencePreferenceStore.remainSignedInKey: remainSignedIn,
  });
  final sharedPreferences = await SharedPreferences.getInstance();
  final sessions = InMemoryAuthSessionStore();
  await sessions.save(
    const AuthSession(accessToken: "access", refreshToken: "refresh"),
  );
  final biometrics = InMemoryBiometricPreferenceStore();
  if (biometricAccountId != null) {
    await biometrics.enableForAccount(biometricAccountId);
  }
  final gateway = _ConfigurableGateway(authenticationResult);
  final apiClient = TheEyeApiClient(
    baseUrl: "http://localhost:4000/v1",
    httpClient: MockClient((request) async {
      if (request.url.path.endsWith(TheEyeApiPaths.usersMe)) {
        if (profileFailure is Exception) throw profileFailure;
        if (profileFailure is Error) throw profileFailure;
        return http.Response(
          jsonEncode({
            "id": profileId,
            "displayName": "Test Citizen",
            "kycStatus": "Unverified",
            "profileComplete": true,
            "profile": {
              "firstName": "Test",
              "lastName": "Citizen",
              "country": "Nigeria",
              "state": "Lagos",
              "lga": "Ikeja",
            },
          }),
          200,
        );
      }
      if (request.url.path.endsWith(TheEyeApiPaths.authLogout)) {
        return http.Response("{}", 200);
      }
      return http.Response("{}", 404);
    }),
  );
  final themeProvider = ThemeProvider(ThemePreferences(sharedPreferences));
  final controller = AppController(
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
    authService: AuthService(apiClient: apiClient, sessionStore: sessions),
    socialAuthService: SocialAuthService(
      apiClient: apiClient,
      sessionStore: sessions,
      googleSignIn: FakeGoogleSignIn(),
    ),
    authSessionStore: sessions,
    authPersistencePreferenceStore:
        AuthPersistencePreferenceStore(sharedPreferences),
    biometricAuthService: BiometricAuthService(gateway: gateway),
    biometricPreferenceStore: biometrics,
    backgroundPushContextPersister: ({
      required String accessToken,
      required String apiBaseUrl,
    }) async {},
    themeProvider: themeProvider,
    vehicleGarageStore: InMemoryVehicleGarageStore(),
  );
  return _Fixture(controller, sessions, biometrics, gateway);
}

class _Fixture {
  const _Fixture(
    this.controller,
    this.sessions,
    this.biometrics,
    this.gateway,
  );

  final AppController controller;
  final InMemoryAuthSessionStore sessions;
  final InMemoryBiometricPreferenceStore biometrics;
  final _ConfigurableGateway gateway;
}

class _ConfigurableGateway implements DeviceBiometricGateway {
  _ConfigurableGateway(this.authenticationResult);

  final Object authenticationResult;
  int authenticationCalls = 0;

  @override
  Future<bool> supportsBiometrics() async => true;

  @override
  Future<List<BiometricType>> enrolledBiometrics() async =>
      const [BiometricType.strong];

  @override
  Future<bool> authenticate({required String reason}) async {
    authenticationCalls += 1;
    final result = authenticationResult;
    if (result is Exception) throw result;
    if (result is Error) throw result;
    return result as bool;
  }
}
