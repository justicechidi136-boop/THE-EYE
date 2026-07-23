import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:geolocator/geolocator.dart';
import 'package:the_eye_watch/config/firebase_bootstrap.dart';
import 'package:the_eye_watch/services/launcher_service.dart';
import 'package:the_eye_watch/services/watch_app_services.dart';
import 'package:the_eye_watch/startup/watch_boot_screen.dart';
import 'package:the_eye_watch/startup/watch_boot_sequencer.dart';
import 'package:the_eye_watch/startup/watch_boot_stage.dart';
import 'package:the_eye_watch/storage/secure_credential_store.dart';

class _FakeLauncher extends LauncherService {
  _FakeLauncher() : super(channel: const MethodChannel('mock.launcher'));

  @override
  Future<bool> isDefaultHome() async => true;

  @override
  Future<bool> isDebugBuild() async => true;

  @override
  Future<void> openSystemSettings() async {}

  @override
  Future<void> openHomeSettings() async {}
}

WatchAppServices _testServices() {
  return WatchAppServices(
    credentials: SecureCredentialStore(memory: {}),
    preferences: PreferencesStore(),
    enablePush: false,
  );
}

WatchBootSequencer _fastSequencer(WatchAppServices services) {
  return WatchBootSequencer(
    services: services,
    firebaseInitializer: () async => const FirebaseBootstrapResult(
      initialized: false,
      errorMessage: 'test-skip-firebase',
    ),
    stageTimeout: const Duration(milliseconds: 200),
    pushTimeout: const Duration(milliseconds: 50),
    overallTimeout: const Duration(seconds: 2),
  );
}

Future<void> _pumpBootChrome(
  WidgetTester tester, {
  required Size physicalSize,
  required WatchAppServices services,
}) async {
  tester.view.physicalSize = physicalSize;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    MaterialApp(
      home: WatchBootScreen(
        services: services,
        launcher: _FakeLauncher(),
        sequencer: _fastSequencer(services),
        minDisplay: const Duration(milliseconds: 50),
      ),
      routes: {
        '/pairing': (_) => const Scaffold(body: Text('PAIRING')),
        '/onboarding/location': (_) => const Scaffold(body: Text('LOCATION')),
      },
    ),
  );

  expect(find.text('THE EYE'), findsOneWidget);
  expect(find.text('SMART WATCH'), findsOneWidget);
  expect(find.byType(LinearProgressIndicator), findsOneWidget);
  expect(find.byType(Image), findsWidgets);

  // Advance boot without leaving periodic heartbeat/GPS timers pending.
  await tester.pump(const Duration(milliseconds: 80));
  services.dispose();
  await tester.pump(const Duration(milliseconds: 400));
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    GeolocatorPlatform.instance = _ImmediateGeolocatorPlatform();
  });

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('boot sequencer reports all five stages', () async {
    final services = _testServices();
    final seen = <WatchBootStage>{};
    final result = await _fastSequencer(services).run(
      onStage: (stage, status, progress) => seen.add(stage),
    );
    expect(result.success, isTrue);
    expect(seen, containsAll(WatchBootStage.values));
    expect(result.degraded, isTrue); // firebase skipped in test
    services.dispose();
  });

  test('boot sequencer continues when firebase times out', () async {
    final services = _testServices();
    final sequencer = WatchBootSequencer(
      services: services,
      firebaseInitializer: () async {
        await Future<void>.delayed(const Duration(seconds: 5));
        return const FirebaseBootstrapResult(initialized: true);
      },
      stageTimeout: const Duration(milliseconds: 40),
      pushTimeout: const Duration(milliseconds: 20),
      overallTimeout: const Duration(seconds: 2),
    );
    final result = await sequencer.run();
    expect(result.success, isTrue);
    expect(result.firebaseReady, isFalse);
    expect(result.degraded, isTrue);
    services.dispose();
  });

  testWidgets('boot screen shows brand chrome on round canvas', (tester) async {
    final services = _testServices();
    addTearDown(services.dispose);
    await _pumpBootChrome(
      tester,
      physicalSize: const Size(384, 384),
      services: services,
    );
  });

  testWidgets('boot screen shows brand chrome on square canvas',
      (tester) async {
    final services = _testServices();
    addTearDown(services.dispose);
    await _pumpBootChrome(
      tester,
      physicalSize: const Size(400, 450),
      services: services,
    );
  });
}

class _ImmediateGeolocatorPlatform extends GeolocatorPlatform {
  @override
  Future<LocationPermission> checkPermission() async =>
      LocationPermission.whileInUse;

  @override
  Future<LocationPermission> requestPermission() async =>
      LocationPermission.whileInUse;

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
